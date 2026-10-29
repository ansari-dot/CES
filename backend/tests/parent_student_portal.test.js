import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/shared/db/knex.js';
import { hashPassword } from '../src/shared/crypto/password.js';
import { zoomRepository } from '../src/modules/zoom/zoom.repository.js';

describe('Module 10: Parent Portal & Student Access Verification Tests', () => {
  let app;
  let principalCookies;
  let principalCsrf;
  let activeSession;
  let activeClass;
  let alternateClass;
  let activeStudent;
  let suspendedStudent;
  let parentEmail;
  let parentPassword;
  let registeredParentId;
  let parentCookies;
  let parentCsrf;
  let studentCookies;
  let studentCsrf;
  let suspendedCookies;
  let suspendedCsrf;
  let activeLesson;
  let alternateLesson;
  let childChallan;

  beforeAll(async () => {
    app = createApp();

    // 1. Principal Login
    const principalRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'principal', password: 'PrincipalPassword123!' });

    expect(principalRes.status).toBe(200);
    principalCookies = principalRes.headers['set-cookie'];
    const pCsrf = principalCookies.find((c) => c.startsWith('sms_csrf='));
    principalCsrf = pCsrf.split(';')[0].split('=')[1];

    // 2. Academic Session & Classes
    activeSession = await db('academic_sessions').where({ is_current: 1 }).first();
    if (!activeSession) {
      activeSession = await db('academic_sessions').first();
    }

    const classes = await db('classes').orderBy('grade_level', 'asc');
    activeClass = classes[0];
    alternateClass = classes[1] || classes[0];

    // 3. Ensure Zoom meetings exist for classes
    let existingMeeting = await db('zoom_meetings').where({ class_id: activeClass.id, status: 'ACTIVE' }).first();
    if (!existingMeeting) {
      await zoomRepository.configureClassMeeting({
        classId: activeClass.id,
        zoomMeetingId: `9200000000${activeClass.id}`.slice(-10),
        joinUrl: `https://zoom.us/j/9200000000${activeClass.id}`,
        passcode: 'CLASS1#',
        topic: `Class ${activeClass.id} Portal Room`
      });
    }

    // 4. Create Active Student User
    const stdPwd = await hashPassword('Student12345!');
    const activeStudentUsername = `std_active_${Date.now()}`;
    const [activeUserId] = await db('users').insert({
      role_id: 4,
      username: activeStudentUsername,
      email: `${activeStudentUsername}@school.pk`,
      phone: `0301${Date.now().toString().slice(-7)}`,
      full_name: 'Active Portal Student',
      password_hash: stdPwd,
      status: 'ACTIVE',
      must_change_password: 0
    });

    const [activeStdId] = await db('students').insert({
      user_id: activeUserId,
      admission_no: `ADM-${Date.now()}`,
      roll_no: '101',
      date_of_birth: '2012-05-15',
      gender: 'MALE',
      admission_date: new Date().toISOString().split('T')[0],
      current_class_id: activeClass.id,
      status: 'ACTIVE'
    });

    activeStudent = {
      id: activeStdId,
      userId: activeUserId,
      username: activeStudentUsername,
      classId: activeClass.id
    };

    // 5. Create Suspended Student User (for non-payment or disciplinary restriction)
    const suspendedUsername = `std_suspended_${Date.now()}`;
    const [suspendedUserId] = await db('users').insert({
      role_id: 4,
      username: suspendedUsername,
      email: `${suspendedUsername}@school.pk`,
      phone: `0302${Date.now().toString().slice(-7)}`,
      full_name: 'Suspended Dues Student',
      password_hash: stdPwd,
      status: 'SUSPENDED',
      must_change_password: 0
    });

    const [suspendedStdId] = await db('students').insert({
      user_id: suspendedUserId,
      admission_no: `ADM-SUSP-${Date.now()}`,
      roll_no: '102',
      date_of_birth: '2012-07-20',
      gender: 'FEMALE',
      admission_date: new Date().toISOString().split('T')[0],
      current_class_id: activeClass.id,
      status: 'SUSPENDED'
    });

    suspendedStudent = {
      id: suspendedStdId,
      userId: suspendedUserId,
      username: suspendedUsername,
      classId: activeClass.id
    };

    // 6. Create or fetch Teacher, Subject, and Today's Lesson for activeClass
    const teacher = await db('teachers').first();
    const subjects = await db('subjects').select();
    const subject = subjects[0];
    const altSubject = subjects[1] || subjects[0];

    const todayStr = new Date().toISOString().split('T')[0];
    const meeting = await db('zoom_meetings').where({ class_id: activeClass.id }).first();

    const [lessonId] = await db('timetable_lessons').insert({
      class_id: activeClass.id,
      subject_id: subject.id,
      teacher_id: teacher.id,
      zoom_meeting_id: meeting ? meeting.id : null,
      lesson_date: todayStr,
      start_at: `${todayStr} 08:00:00`,
      end_at: `${todayStr} 23:59:00`,
      status: 'LIVE'
    });

    activeLesson = { id: lessonId, classId: activeClass.id };

    // Create a lesson for alternateClass
    if (alternateClass.id !== activeClass.id) {
      const altMeeting = await db('zoom_meetings').where({ class_id: alternateClass.id }).first();
      const [altLessonId] = await db('timetable_lessons').insert({
        class_id: alternateClass.id,
        subject_id: altSubject.id,
        teacher_id: teacher.id,
        zoom_meeting_id: altMeeting ? altMeeting.id : null,
        lesson_date: todayStr,
        start_at: `${todayStr} 08:00:00`,
        end_at: `${todayStr} 23:59:00`,
        status: 'LIVE'
      });
      alternateLesson = { id: altLessonId, classId: alternateClass.id };
    }

    // 7. Create Fee Challan for Active Student
    const [challanId] = await db('fee_challans').insert({
      challan_number: `CHL-MOD10-${Date.now()}`,
      consumer_number: `1000${Date.now().toString().slice(-6)}`,
      session_id: activeSession.id,
      student_id: activeStudent.id,
      class_id: activeClass.id,
      billing_month: '2026-10',
      issue_date: todayStr,
      due_date: '2026-10-31',
      valid_until: '2026-11-10',
      total_payable: 7500.0,
      paid_amount: 0.0,
      status: 'UNPAID'
    });

    childChallan = { id: challanId, studentId: activeStudent.id, totalPayable: 7500.0 };

    parentEmail = `parent_${Date.now()}@example.pk`;
    parentPassword = 'ParentSecurePassword123!';
  });

  afterAll(async () => {
    // Clean up created records
    if (childChallan?.id) {
      await db('fee_payment_proofs').where({ challan_id: childChallan.id }).del();
      await db('fee_challans').where({ id: childChallan.id }).del();
    }
    if (activeLesson?.id) {
      await db('zoom_participant_log').where({ lesson_id: activeLesson.id }).del();
      await db('timetable_lessons').where({ id: activeLesson.id }).del();
    }
    if (alternateLesson?.id) {
      await db('zoom_participant_log').where({ lesson_id: alternateLesson.id }).del();
      await db('timetable_lessons').where({ id: alternateLesson.id }).del();
    }
    const parentRec = registeredParentId ? await db('parents').where({ id: registeredParentId }).first() : null;
    if (registeredParentId) {
      await db('parent_student').where({ parent_id: registeredParentId }).del();
      await db('parents').where({ id: registeredParentId }).del();
    }
    if (activeStudent?.id) {
      await db('students').where({ id: activeStudent.id }).del();
    }
    if (suspendedStudent?.id) {
      await db('students').where({ id: suspendedStudent.id }).del();
    }

    const userIds = [parentRec?.user_id, activeStudent?.userId, suspendedStudent?.userId].filter(Boolean);
    if (userIds.length > 0) {
      await db('refresh_tokens').whereIn('user_id', userIds).del();
      await db('users').whereIn('id', userIds).del();
    }
    await db.destroy();
  });

  describe('1. Parent Registration & Principal Approval Workflow', () => {
    test('POST /api/v1/parents/register - should allow public parent self-registration without CSRF', async () => {
      const res = await request(app)
        .post('/api/v1/parents/register')
        .send({
          name: 'Muhammad Tariq',
          email: parentEmail,
          phone: `0300${Date.now().toString().slice(-7)}`,
          cnic: `35201-${Date.now().toString().slice(-7)}-1`,
          relation: 'FATHER',
          password: parentPassword
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.verificationStatus).toBe('PENDING');

      registeredParentId = res.body.data.id;
    });

    test('GET /api/v1/parents - Principal lists registered parents and finds pending applicant', async () => {
      const res = await request(app)
        .get('/api/v1/parents?status=PENDING')
        .set('Cookie', principalCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      const found = res.body.data.find((p) => p.id === registeredParentId);
      expect(found).toBeDefined();
      expect(found.email).toBe(parentEmail);
    });

    test('POST /api/v1/parents/:id/approve - Principal approves parent and links active child', async () => {
      const res = await request(app)
        .post(`/api/v1/parents/${registeredParentId}/approve`)
        .set('Cookie', principalCookies)
        .set('X-CSRF-Token', principalCsrf)
        .send({
          status: 'APPROVED',
          children: [
            {
              studentId: activeStudent.id,
              relation: 'FATHER',
              isPrimary: true
            }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.verificationStatus).toBe('APPROVED');
      expect(res.body.data.children.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.children[0].studentId).toBe(activeStudent.id);
    });
  });

  describe('2. Parent Portal Authentication & Child Monitoring', () => {
    test('POST /api/v1/auth/login - Parent successfully logs into parent portal', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: parentEmail,
          password: parentPassword
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('PARENT');

      parentCookies = res.headers['set-cookie'];
      const pCsrf = parentCookies.find((c) => c.startsWith('sms_csrf='));
      parentCsrf = pCsrf.split(';')[0].split('=')[1];
    });

    test('GET /api/v1/parents/me/dashboard - Parent views children dashboard with metrics and schedule', async () => {
      const res = await request(app)
        .get('/api/v1/parents/me/dashboard')
        .set('Cookie', parentCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('parent');
      expect(res.body.data).toHaveProperty('children');
      expect(res.body.data.children.length).toBeGreaterThanOrEqual(1);

      const child = res.body.data.children.find((c) => c.studentId === activeStudent.id);
      expect(child).toBeDefined();
      expect(child).toHaveProperty('attendanceRate');
      expect(child).toHaveProperty('pendingTasksCount');
      expect(child).toHaveProperty('totalOutstandingFee');
      expect(child.totalOutstandingFee).toBeGreaterThanOrEqual(7500);
      expect(Array.isArray(child.todaySchedule)).toBe(true);
    });

    test('GET /api/v1/parents/me/children/:studentId/challans - Parent views fee challans with 1Link numbers', async () => {
      const res = await request(app)
        .get(`/api/v1/parents/me/children/${activeStudent.id}/challans`)
        .set('Cookie', parentCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      const challan = res.body.data.find((c) => c.id === childChallan.id);
      expect(challan).toBeDefined();
      expect(challan.consumerNumber).toMatch(/^\d{10}$/);
      expect(challan.totalPayable).toBe(7500);
      expect(challan.status).toBe('UNPAID');
    });

    test('POST /api/v1/parents/me/children/:studentId/challans/:challanId/pay - Parent submits online payment proof', async () => {
      const res = await request(app)
        .post(`/api/v1/parents/me/children/${activeStudent.id}/challans/${childChallan.id}/pay`)
        .set('Cookie', parentCookies)
        .set('X-CSRF-Token', parentCsrf)
        .send({
          submittedAmount: 7500,
          bankOrWallet: 'Easypaisa / 1Link Bill Payment',
          transactionReference: `EP-PRN-${Date.now()}`,
          paymentDate: new Date().toISOString().split('T')[0]
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(['PENDING', 'PENDING_VERIFICATION']).toContain(res.body.data.status);
      expect(res.body.data.submittedAmount).toBe(7500);
    });

    test('GET /api/v1/parents/me/children/:studentId/challans - Access denied (403) for unlinked student', async () => {
      const fakeStudentId = 999999;
      const res = await request(app)
        .get(`/api/v1/parents/me/children/${fakeStudentId}/challans`)
        .set('Cookie', parentCookies);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('3. Student Portal Access & Classroom Live Zoom Session', () => {
    test('POST /api/v1/auth/login - Active student successfully logs in', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: activeStudent.username,
          password: 'Student12345!'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('STUDENT');

      studentCookies = res.headers['set-cookie'];
      const sCsrf = studentCookies.find((c) => c.startsWith('sms_csrf='));
      studentCsrf = sCsrf.split(';')[0].split('=')[1];
    });

    test('GET /api/v1/students/me/dashboard - Active student loads comprehensive dashboard', async () => {
      const res = await request(app)
        .get('/api/v1/students/me/dashboard')
        .set('Cookie', studentCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accountStatus).toBe('ACTIVE');
      expect(res.body.data.isRestricted).toBe(false);
      expect(res.body.data).toHaveProperty('student');
      expect(res.body.data).toHaveProperty('schedule');
      expect(res.body.data).toHaveProperty('tasks');
      expect(res.body.data).toHaveProperty('attendanceRate');
      expect(res.body.data).toHaveProperty('totalOutstandingFee');
    });

    test('GET /api/v1/students/me/live-lesson/:lessonId/join - Active student receives decrypted Zoom URL and logs participant intent', async () => {
      const res = await request(app)
        .get(`/api/v1/students/me/live-lesson/${activeLesson.id}/join`)
        .set('Cookie', studentCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.inWindow).toBe(true);
      expect(res.body.data.joinUrl).toMatch(/^https:\/\/zoom\.us\/j\//);
      expect(res.body.data).toHaveProperty('passcode');

      // Verify participant log was recorded in database
      const log = await db('zoom_participant_log')
        .where({ lesson_id: activeLesson.id, user_id: activeStudent.userId })
        .first();
      expect(log).toBeDefined();
      expect(log.source).toBe('PORTAL');
    });

    test('GET /api/v1/students/me/live-lesson/:lessonId/join - Access denied (403) when student attempts to join another class', async () => {
      if (alternateLesson) {
        const res = await request(app)
          .get(`/api/v1/students/me/live-lesson/${alternateLesson.id}/join`)
          .set('Cookie', studentCookies);

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('FORBIDDEN');
      }
    });
  });

  describe('4. Suspended Student Restriction Enforcement (SRS Section 2.4 & 14)', () => {
    test('POST /api/v1/auth/login - Suspended student logs in', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: suspendedStudent.username,
          password: 'Student12345!'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      suspendedCookies = res.headers['set-cookie'];
      const sCsrf = suspendedCookies.find((c) => c.startsWith('sms_csrf='));
      suspendedCsrf = sCsrf.split(';')[0].split('=')[1];
    });

    test('GET /api/v1/students/me/dashboard - Suspended student dashboard enforces restricted mode', async () => {
      const res = await request(app)
        .get('/api/v1/students/me/dashboard')
        .set('Cookie', suspendedCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accountStatus).toBe('SUSPENDED');
      expect(res.body.data.isRestricted).toBe(true);
      expect(res.body.data.suspensionReason).toMatch(/restricted/i);
      expect(res.body.data.resolutionMessage).toMatch(/fee dues|Principal/i);
      // Ensure private classroom content is stripped
      expect(res.body.data.schedule).toBeUndefined();
    });

    test('GET /api/v1/students/me/live-lesson/:lessonId/join - Suspended student is blocked from live lesson (403 ACCOUNT_SUSPENDED)', async () => {
      const res = await request(app)
        .get(`/api/v1/students/me/live-lesson/${activeLesson.id}/join`)
        .set('Cookie', suspendedCookies);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
    });
  });
});
