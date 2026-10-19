import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/shared/db/knex.js';

describe('Module 4: Daily Operations (Lessons & Attendance) Tests', () => {
  let app;
  let principalCookies;
  let principalCsrf;
  let teacherCookies;
  let teacherCsrf;
  let teacherId;
  let testLessonId;
  let student1Id;
  let student2Id;

  beforeAll(async () => {
    app = createApp();

    // 1. Principal Login
    const principalRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'principal', password: 'PrincipalPassword123!' });

    expect(principalRes.status).toBe(200);
    principalCookies = principalRes.headers['set-cookie'];
    const pCsrfCookie = principalCookies.find((c) => c.startsWith('sms_csrf='));
    principalCsrf = pCsrfCookie.split(';')[0].split('=')[1];

    // 2. Teacher Login
    const teacherRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'ayesha.math@school.pk', password: 'TeacherPassword123!' });

    expect(teacherRes.status).toBe(200);
    teacherCookies = teacherRes.headers['set-cookie'];
    const tCsrfCookie = teacherCookies.find((c) => c.startsWith('sms_csrf='));
    teacherCsrf = tCsrfCookie.split(';')[0].split('=')[1];

    // Teacher ID
    const teacherRecord = await db('teachers')
      .join('users', 'teachers.user_id', 'users.id')
      .where('users.email', 'ayesha.math@school.pk')
      .select('teachers.id')
      .first();
    teacherId = teacherRecord.id;

    // Clean up attendance tables
    await db('attendance_corrections').del();
    await db('lesson_attendance_submissions').del();
    await db('lesson_attendance').del();

    // Ensure students exist in Class 1
    const studentsInClass1 = await db('students').where({ current_class_id: 1, status: 'ACTIVE' });
    if (studentsInClass1.length < 2) {
      // Create test user and student 1
      const [u1] = await db('users').insert({
        role_id: 4,
        username: `student_test_1_${Date.now()}`,
        email: `student1_${Date.now()}@school.pk`,
        full_name: 'Test Student 1',
        password_hash: 'hash',
        status: 'ACTIVE'
      });
      const todayStr = new Date().toISOString().split('T')[0];
      const [s1] = await db('students').insert({
        user_id: u1,
        admission_no: `ADM-${Date.now()}`,
        roll_no: '01',
        admission_date: todayStr,
        current_class_id: 1,
        status: 'ACTIVE'
      });
      student1Id = s1;

      // Create test user and student 2
      const [u2] = await db('users').insert({
        role_id: 4,
        username: `student_test_2_${Date.now()}`,
        email: `student2_${Date.now()}@school.pk`,
        full_name: 'Test Student 2',
        password_hash: 'hash',
        status: 'ACTIVE'
      });
      const [s2] = await db('students').insert({
        user_id: u2,
        admission_no: `ADM-${Date.now() + 1}`,
        roll_no: '02',
        admission_date: todayStr,
        current_class_id: 1,
        status: 'ACTIVE'
      });
      student2Id = s2;
    } else {
      student1Id = studentsInClass1[0].id;
      student2Id = studentsInClass1[1].id;
    }

    // Create a dedicated test lesson for Class 1
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const meeting = await db('zoom_meetings').where({ class_id: 1, status: 'ACTIVE' }).first();

    const [lesId] = await db('timetable_lessons').insert({
      class_id: 1,
      subject_id: 1,
      teacher_id: teacherId,
      zoom_meeting_id: meeting ? meeting.id : null,
      lesson_date: today,
      start_at: new Date(now.getTime() - 45 * 60 * 1000),
      end_at: new Date(now.getTime()),
      status: 'SCHEDULED'
    });
    testLessonId = lesId;
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('Lesson Roster API', () => {
    it('should return enrolled students roster for the lesson', async () => {
      const res = await request(app)
        .get(`/api/v1/attendance/lessons/${testLessonId}/roster`)
        .set('Cookie', teacherCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.lesson).toBeDefined();
      expect(res.body.data.isLocked).toBe(false);
      expect(Array.isArray(res.body.data.roster)).toBe(true);
      expect(res.body.data.roster.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Lesson Delivery Logging', () => {
    it('should record lesson delivery with topic, notes, and completion', async () => {
      const res = await request(app)
        .post(`/api/v1/attendance/lessons/${testLessonId}/delivery`)
        .set('Cookie', teacherCookies)
        .set('X-CSRF-Token', teacherCsrf)
        .send({
          topicCovered: 'Quadratic Equations & Problem Solving',
          teachingNotes: 'Completed textbook exercises 3.1 to 3.4. All students participated.',
          resourceUrl: 'https://resources.school.pk/math/class1-ch3.pdf',
          problemCategory: 'NONE'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('COMPLETED');
      expect(res.body.data.topic_covered).toBe('Quadratic Equations & Problem Solving');
    });
  });

  describe('Submit & Lock Attendance', () => {
    it('should submit and lock attendance for enrolled students', async () => {
      const res = await request(app)
        .post(`/api/v1/attendance/lessons/${testLessonId}/submit`)
        .set('Cookie', teacherCookies)
        .set('X-CSRF-Token', teacherCsrf)
        .send({
          records: [
            { studentId: student1Id, status: 'PRESENT', remarks: 'Active engagement' },
            { studentId: student2Id, status: 'ABSENT', remarks: 'Unexcused absence' }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isLocked).toBe(true);
      expect(res.body.data.presentCount).toBe(1);
      expect(res.body.data.absentCount).toBe(1);
    });

    it('should reject direct re-submission when attendance is locked (409 Conflict)', async () => {
      const res = await request(app)
        .post(`/api/v1/attendance/lessons/${testLessonId}/submit`)
        .set('Cookie', teacherCookies)
        .set('X-CSRF-Token', teacherCsrf)
        .send({
          records: [
            { studentId: student1Id, status: 'PRESENT' },
            { studentId: student2Id, status: 'PRESENT' }
          ]
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ATTENDANCE_LOCKED');
      expect(res.body.error.message).toContain('finalized and locked');
    });

    it('should reflect locked status in lesson roster', async () => {
      const res = await request(app)
        .get(`/api/v1/attendance/lessons/${testLessonId}/roster`)
        .set('Cookie', teacherCookies);

      expect(res.status).toBe(200);
      expect(res.body.data.isLocked).toBe(true);
      expect(res.body.data.submission).toBeDefined();
    });
  });

  describe('Attendance Correction Vouchers (Audit Protocol)', () => {
    let correctionId;

    it('should allow teacher to submit correction voucher for locked attendance', async () => {
      const res = await request(app)
        .post('/api/v1/attendance/corrections')
        .set('Cookie', teacherCookies)
        .set('X-CSRF-Token', teacherCsrf)
        .send({
          lessonId: testLessonId,
          studentId: student2Id,
          proposedStatus: 'EXCUSED',
          reason: 'Parent provided medical certificate for dental treatment'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.original_status).toBe('ABSENT');
      expect(res.body.data.proposed_status).toBe('EXCUSED');
      correctionId = res.body.data.id;
    });

    it('should list pending correction requests for Principal', async () => {
      const res = await request(app)
        .get('/api/v1/attendance/corrections?status=PENDING')
        .set('Cookie', principalCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.some((c) => c.id === correctionId)).toBe(true);
    });

    it('should allow Principal to approve correction voucher and update attendance record', async () => {
      const res = await request(app)
        .post(`/api/v1/attendance/corrections/${correctionId}/review`)
        .set('Cookie', principalCookies)
        .set('X-CSRF-Token', principalCsrf)
        .send({
          status: 'APPROVED',
          reviewRemarks: 'Medical certificate verified and approved'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('APPROVED');

      // Verify student attendance record in database changed to EXCUSED
      const record = await db('lesson_attendance')
        .where({ lesson_id: testLessonId, student_id: student2Id })
        .first();
      expect(record.status).toBe('EXCUSED');

      // Verify submission counts were updated
      const submission = await db('lesson_attendance_submissions')
        .where({ lesson_id: testLessonId })
        .first();
      expect(submission.absent_count).toBe(0);
      expect(submission.excused_count).toBe(1);
    });
  });

  describe('Attendance Statistics & Rates', () => {
    it('should return aggregated attendance stats for Class 1', async () => {
      const res = await request(app)
        .get('/api/v1/attendance/stats?classId=1')
        .set('Cookie', principalCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBeGreaterThanOrEqual(2);
      expect(res.body.data.attendanceRate).toBeGreaterThanOrEqual(0);
    });
  });
});
