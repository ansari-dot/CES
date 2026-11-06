import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { db } from '../src/shared/db/knex.js';
import { sessionStore } from '../src/shared/session/sessionStore.js';

async function runDateSheetTests() {
  console.log('🚀 Starting Examination Date Sheet Engine Test Suite...\n');

  const app = createApp();
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let passed = 0;
  let failed = 0;

  function report(name, ok, msg = '') {
    if (ok) {
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${name} -> ${msg}`);
      failed++;
    }
  }

  try {
    // Clean up any previous test date sheets
    await db('date_sheet_entries').delete();
    await db('examination_date_sheets').delete();

    // 1. Fetch test users: Principal, Teacher, Student (Class 4), Student (Class 5)
    const principalUser = await db('users')
      .join('roles', 'users.role_id', 'roles.id')
      .whereIn('roles.code', ['PRINCIPAL', 'ADMIN'])
      .select('users.*', 'roles.code as role_code')
      .first();

    const teacher = await db('teachers')
      .join('users', 'teachers.user_id', 'users.id')
      .join('roles', 'users.role_id', 'roles.id')
      .select('teachers.id as teacher_id', 'users.id as user_id', 'users.full_name', 'roles.code as role_code')
      .first();

    // Assign this teacher to Class 4 Mathematics (subject_id: 1)
    await db('teacher_assignments')
      .insert({
        teacher_id: teacher.teacher_id,
        class_id: 4,
        subject_id: 1,
        session_id: 1,
        effective_from: '2026-08-01',
        assigned_by: principalUser.id
      })
      .onConflict(['teacher_id', 'class_id', 'subject_id'])
      .ignore();

    // Student for Class 4: Ensure enrollment in class 4
    let student4 = await db('students as s')
      .join('users as u', 's.user_id', 'u.id')
      .join('roles as r', 'u.role_id', 'r.id')
      .select('s.id as student_id', 'u.id as user_id', 's.current_class_id', 'r.code as role_code')
      .first();

    await db('students').where({ id: student4.student_id }).update({ current_class_id: 4 });
    student4.current_class_id = 4;

    await db('enrollments')
      .insert({
        student_id: student4.student_id,
        class_id: 4,
        session_id: 1,
        roll_no: '4A-01',
        status: 'ACTIVE',
        enrolled_on: '2026-08-01'
      })
      .onConflict(['student_id', 'session_id'])
      .merge({ class_id: 4, status: 'ACTIVE' });

    // Student for Class 5
    let student5 = await db('students as s')
      .join('users as u', 's.user_id', 'u.id')
      .join('roles as r', 'u.role_id', 'r.id')
      .whereNot('s.id', student4.student_id)
      .select('s.id as student_id', 'u.id as user_id', 's.current_class_id', 'r.code as role_code')
      .first();

    if (student5) {
      await db('students').where({ id: student5.student_id }).update({ current_class_id: 5, status: 'ACTIVE' });
      await db('users').where({ id: student5.user_id }).update({ status: 'ACTIVE' });
      student5.current_class_id = 5;

      await db('enrollments')
        .insert({
          student_id: student5.student_id,
          class_id: 5,
          session_id: 1,
          roll_no: '5A-01',
          status: 'ACTIVE',
          enrolled_on: '2026-08-01'
        })
        .onConflict(['student_id', 'session_id'])
        .merge({ class_id: 5, status: 'ACTIVE' });
    }

    // Create server sessions
    const principalSess = await sessionStore.createSession({ userId: principalUser.id, roleCode: 'PRINCIPAL' });
    const teacherSess = await sessionStore.createSession({ userId: teacher.user_id, roleCode: 'TEACHER' });
    const student4Sess = await sessionStore.createSession({ userId: student4.user_id, roleCode: 'STUDENT' });
    const student5Sess = student5 ? await sessionStore.createSession({ userId: student5.user_id, roleCode: 'STUDENT' }) : null;

    // Helper for requests
    async function request(path, options = {}, sess) {
      const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
      if (sess && sess.sessionId) {
        headers['Cookie'] = `sms_sid=${sess.sessionId}`;
      }

      const res = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers
      });

      const text = await res.text();
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
      return { status: res.status, body };
    }

    console.log('--- 1. Principal Creating Examination Date Sheet & Testing 1-Exam-Per-Day Rule ---');

    // Attempt invalid Mid-Term with two exams for Class 4 on the same day -> Must be rejected with 422
    const invalidTwoExamsPayload = {
      academicSessionId: 1,
      examType: 'MID_TERM',
      title: 'Invalid Mid-Term with 2 Exams on Same Day',
      status: 'DRAFT',
      entries: [
        { classId: 4, subjectId: 1, examDate: '2026-10-06', startTime: '08:00 AM', endTime: '09:30 AM' },
        { classId: 4, subjectId: 2, examDate: '2026-10-06', startTime: '10:00 AM', endTime: '12:00 PM' }
      ]
    };
    const resInvalid = await request('/api/v1/datesheets', {
      method: 'POST',
      body: JSON.stringify(invalidTwoExamsPayload)
    }, principalSess);

    report('Mandatory Rule: Rejects multiple examinations for same class on same day with 422', resInvalid.status === 422);

    // Now create a valid multi-class Mid-Term Date Sheet (One Subject Per Class Per Day)
    const createPayload = {
      academicSessionId: 1,
      examType: 'MID_TERM',
      title: 'Timetable for HALF YEARLY',
      description: 'Official Mid-Term Examination. Entry closes 15 minutes before exam start.',
      status: 'DRAFT',
      entries: [
        // Class 4 - Day 1 (08:00 AM)
        {
          classId: 4,
          subjectId: 1, // Math
          teacherId: teacher.teacher_id,
          examDate: '2026-10-06',
          startTime: '08:00 AM',
          endTime: '11:00 AM',
          subjectType: 'Scholastic',
          instructions: 'Bring geometry set'
        },
        // Class 4 - Day 2
        {
          classId: 4,
          subjectId: 2, // English
          teacherId: null,
          examDate: '2026-10-07',
          startTime: '08:00 AM',
          endTime: '11:00 AM',
          subjectType: 'Scholastic',
          instructions: 'No dictionaries permitted'
        },
        // Class 4 - Day 3
        {
          classId: 4,
          subjectId: 3, // Science
          teacherId: null,
          examDate: '2026-10-08',
          startTime: '08:00 AM',
          endTime: '11:00 AM',
          subjectType: 'Scholastic'
        },
        // Class 5 - Day 1 (Math)
        {
          classId: 5,
          subjectId: 1, // Math
          teacherId: null,
          examDate: '2026-10-06',
          startTime: '08:00 AM',
          endTime: '11:00 AM',
          subjectType: 'Scholastic'
        }
      ]
    };

    const resCreate = await request('/api/v1/datesheets', {
      method: 'POST',
      body: JSON.stringify(createPayload)
    }, principalSess);

    report('Principal created date sheet with multi-class schedule', resCreate.status === 201 && resCreate.body.success);
    const dateSheetId = resCreate.body?.data?.id;
    report('Date sheet assigned ID', Boolean(dateSheetId));
    report('Created as DRAFT (is_published = false)', resCreate.body?.data?.is_published === false);

    console.log('\n--- 2. Checking Mode A DEDICATED_EXAM Configuration ---');
    report('Scheduling mode automatically set to DEDICATED_EXAM', resCreate.body?.data?.scheduling_mode === 'DEDICATED_EXAM');
    report('Start date resolved correctly', Boolean(resCreate.body?.data?.start_date));
    report('End date resolved correctly', Boolean(resCreate.body?.data?.end_date));

    console.log('\n--- 3. Verifying Student Visibility for DRAFT (Hidden) Date Sheet ---');
    // Student queries active date sheets
    const resStudentDraft = await request('/api/v1/datesheets/student/active', { method: 'GET' }, student4Sess);
    report('Student cannot see unpublished/draft date sheet', resStudentDraft.body?.data?.activeDateSheets?.length === 0);
    report('No announcement popup for draft date sheet', resStudentDraft.body?.data?.popupAnnouncement === null);

    console.log('\n--- 4. Principal Publishing Date Sheet ---');
    const resPublish = await request(`/api/v1/datesheets/${dateSheetId}/publish`, {
      method: 'PATCH',
      body: JSON.stringify({ isPublished: true })
    }, principalSess);

    report('Principal successfully published date sheet', resPublish.status === 200 && resPublish.body?.data?.is_published === true);
    report('Status transitioned to PUBLISHED', resPublish.body?.data?.status === 'PUBLISHED');

    console.log('\n--- 5. Student Enrolled Class Schedule Isolation ---');
    // Class 4 Student queries active date sheets
    const resStudent4 = await request('/api/v1/datesheets/student/active', { method: 'GET' }, student4Sess);
    report('Class 4 student receives active published date sheet', resStudent4.body?.data?.activeDateSheets?.length >= 1);
    const class4Sheet = resStudent4.body?.data?.activeDateSheets?.find((s) => s.id === dateSheetId);
    report('Class 4 student sees ONLY Class 4 papers (3 papers)', class4Sheet && class4Sheet.entries.length === 3);
    report('Class 4 student sees ZERO Class 5 papers (strict isolation)', class4Sheet && class4Sheet.entries.every((e) => e.class_id === 4));
    report('Class 4 student receives announcement popup for their class', resStudent4.body?.data?.popupAnnouncement !== null);

    // Class 5 Student queries active date sheets
    if (student5Sess) {
      const resStudent5 = await request('/api/v1/datesheets/student/active', { method: 'GET' }, student5Sess);
      const class5Sheet = resStudent5.body?.data?.activeDateSheets?.find((s) => s.id === dateSheetId);
      report('Class 5 student sees ONLY Class 5 papers (1 paper)', class5Sheet && class5Sheet.entries.length === 1 && class5Sheet.entries[0].class_id === 5);
      report('Class 5 student sees ZERO Class 4 papers', class5Sheet && class5Sheet.entries.every((e) => e.class_id === 5));
    }

    console.log('\n--- 6. Teacher Assigned Subject & Class Schedule Isolation ---');
    // Teacher queries active date sheets
    const resTeacher = await request('/api/v1/datesheets/teacher/active', { method: 'GET' }, teacherSess);
    report('Teacher receives active date sheets', resTeacher.body?.data?.activeDateSheets?.length >= 1);
    const teacherSheet = resTeacher.body?.data?.activeDateSheets?.find((s) => s.id === dateSheetId);
    report('Teacher sees ONLY assigned Math papers', teacherSheet && teacherSheet.entries.every((e) => e.subject_id === 1));
    report('Teacher does NOT see English or Science papers taught by other faculty', teacherSheet && teacherSheet.entries.every((e) => e.subject_id === 1));

    console.log('\n--- 7. Principal Hiding Date Sheet (Unhide/Hide Real-Time Toggle) ---');
    const resHide = await request(`/api/v1/datesheets/${dateSheetId}/publish`, {
      method: 'PATCH',
      body: JSON.stringify({ isPublished: false })
    }, principalSess);

    report('Principal successfully hid date sheet', resHide.status === 200 && resHide.body?.data?.is_published === false);
    report('Status changed to HIDDEN (data preserved)', resHide.body?.data?.status === 'HIDDEN');

    // Verify immediately hidden for student
    const resStudentAfterHide = await request('/api/v1/datesheets/student/active', { method: 'GET' }, student4Sess);
    report('Student popup immediately disappears when date sheet is hidden', resStudentAfterHide.body?.data?.popupAnnouncement === null);
    report('Student active date sheets empty when hidden', resStudentAfterHide.body?.data?.activeDateSheets?.length === 0);

    console.log('\n--- 8. Principal Unhiding Date Sheet Again ---');
    const resUnhide = await request(`/api/v1/datesheets/${dateSheetId}/publish`, {
      method: 'PATCH',
      body: JSON.stringify({ isPublished: true })
    }, principalSess);

    report('Principal successfully unhid date sheet', resUnhide.status === 200 && resUnhide.body?.data?.is_published === true);
    const resStudentAfterUnhide = await request('/api/v1/datesheets/student/active', { method: 'GET' }, student4Sess);
    report('Student popup re-appears when unhidden', resStudentAfterUnhide.body?.data?.popupAnnouncement !== null);

    console.log('\n--- 9. Verifying Audit Trail Logging ---');
    const auditLogs = await db('audit_logs')
      .where('record_identifier', `EDS-${dateSheetId}`)
      .orderBy('id', 'desc');

    report('Audit logs recorded for Date Sheet lifecycle events', auditLogs.length >= 3);
    report('Audit records include CREATE and PUBLISH/HIDE actions', auditLogs.some((l) => l.action === 'CREATE_DATE_SHEET') && auditLogs.some((l) => l.action.includes('DATE_SHEET')));

    console.log('\n========================================');
    console.log(`Date Sheet Test Results: ${passed} Passed, ${failed} Failed`);
    console.log('========================================\n');

  } catch (err) {
    console.error('Test Execution Error:', err);
    failed++;
  } finally {
    server.close();
    setTimeout(() => process.exit(failed > 0 ? 1 : 0), 100);
  }
}

runDateSheetTests();
