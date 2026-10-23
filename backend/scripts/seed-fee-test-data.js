/**
 * Dummy data for MANUAL testing of fee restriction, Principal "Allow Access"
 * and student timezone display.
 *
 *   npm run seed:fee-test           -> (re)create the test data (resets it to the starting state)
 *   npm run seed:fee-test -- --clean -> remove the test data only
 *
 * Only touches records it creates: users named "test.*", their students,
 * invoices, restriction history, and lessons whose topic starts with "[TZ TEST]".
 */

import { db } from '../src/shared/db/knex.js';
import { config } from '../src/config/index.js';
import { hashPassword } from '../src/shared/crypto/password.js';
import { toZonedDateString, addDays } from '../src/modules/fees/fees.billing.js';

const PASSWORD = 'TestStudent123!';
const LESSON_MARKER = '[TZ TEST]';

// What each test student represents
const STUDENTS = [
  { username: 'test.overdue', name: 'Test Overdue Student', admissionNo: 'TEST-001', scenario: 'overdue' },
  { username: 'test.partial', name: 'Test Partial Payment', admissionNo: 'TEST-002', scenario: 'partial' },
  { username: 'test.grace', name: 'Test Grace Period', admissionNo: 'TEST-003', scenario: 'grace' },
  { username: 'test.paid', name: 'Test Paid Student', admissionNo: 'TEST-004', scenario: 'paid' },
  { username: 'test.exempt', name: 'Test Exempt Student', admissionNo: 'TEST-005', scenario: 'exempt' }
];

async function clean() {
  const users = await db('users').where('username', 'like', 'test.%').select('id');
  const userIds = users.map((u) => u.id);
  if (userIds.length) {
    const students = await db('students').whereIn('user_id', userIds).select('id');
    const studentIds = students.map((s) => s.id);
    if (studentIds.length) {
      await db('fee_restriction_events').whereIn('student_id', studentIds).del();
      await db('fee_payment_proofs').whereIn('student_id', studentIds).del();
      await db('fee_challans').whereIn('student_id', studentIds).del();
      await db('student_concessions').whereIn('student_id', studentIds).del();
      await db('audit_logs')
        .where('record_type', 'Student Account')
        .whereIn('record_identifier', studentIds.map(String))
        .del();
      await db('students').whereIn('id', studentIds).del();
    }
    await db('account_status_history').whereIn('user_id', userIds).del();
    await db('refresh_tokens').whereIn('user_id', userIds).del();
    await db('users').whereIn('id', userIds).del();
  }
  await db('timetable_lessons').where('topic_covered', 'like', `${LESSON_MARKER}%`).del();
  return userIds.length;
}

function invoiceFor(scenario, schoolToday) {
  const base = {
    tuition_amount: 7000,
    technology_amount: 500,
    gross_amount: 7500,
    concession_amount: 0,
    total_payable: 7500,
    paid_amount: 0,
    status: 'UNPAID'
  };
  // Last month's invoice: due 5th, grace ended on the 10th -> already overdue
  const lastMonth = addDays(`${schoolToday.slice(0, 7)}-01`, -1).slice(0, 7);
  const lastMonthLabel = new Date(`${lastMonth}-01T00:00:00Z`).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  });
  const overdueDates = {
    billing_month: lastMonthLabel,
    issue_date: `${lastMonth}-01`,
    due_date: `${lastMonth}-05`,
    valid_until: `${lastMonth}-10`
  };

  switch (scenario) {
    case 'overdue':
      return { ...base, ...overdueDates };
    case 'partial':
      return { ...base, ...overdueDates, paid_amount: 3000, status: 'PARTIALLY_PAID' };
    case 'paid':
      return { ...base, ...overdueDates, paid_amount: 7500, status: 'PAID' };
    case 'exempt':
      // 100% concession: nothing payable, so never restricted
      return { ...base, ...overdueDates, concession_amount: 7500, total_payable: 0 };
    case 'grace':
      // Deadline passed 2 days ago, grace period ends in 3 days -> not yet restricted
      return {
        ...base,
        billing_month: 'Grace Test',
        issue_date: addDays(schoolToday, -5),
        due_date: addDays(schoolToday, -2),
        valid_until: addDays(schoolToday, 3)
      };
    default:
      throw new Error(`Unknown scenario ${scenario}`);
  }
}

async function seed() {
  const hasTable = await db.schema.hasTable('fee_restriction_events');
  if (!hasTable) {
    throw new Error('Run "npm run migrate" first (fee_restriction_events table is missing).');
  }

  const session = (await db('academic_sessions').where({ is_current: 1 }).first()) || (await db('academic_sessions').first());
  if (!session) throw new Error('No academic session found. Create one in the Principal portal first.');

  const structure = await db('fee_structures').where({ session_id: session.id, status: 'ACTIVE' }).first();
  const classRow = structure
    ? await db('classes').where({ id: structure.class_id }).first()
    : await db('classes').orderBy('id').first();
  if (!classRow) throw new Error('No class found. Create classes in the Principal portal first.');

  const subject = await db('subjects').orderBy('id').first();
  const teacher = await db('teachers').orderBy('id').first();

  const schoolToday = toZonedDateString(new Date(), config.SCHOOL_TIMEZONE);
  const passwordHash = await hashPassword(PASSWORD);
  const created = [];

  for (const [i, s] of STUDENTS.entries()) {
    const [userId] = await db('users').insert({
      role_id: (await db('roles').where({ code: 'STUDENT' }).first()).id,
      username: s.username,
      email: `${s.username}@test.local`,
      full_name: s.name,
      password_hash: passwordHash,
      must_change_password: 0,
      status: 'ACTIVE'
    });
    const [studentId] = await db('students').insert({
      user_id: userId,
      admission_no: s.admissionNo,
      roll_no: String(90 + i),
      admission_date: session.start_date,
      current_class_id: classRow.id,
      status: 'ACTIVE'
    });

    const inv = invoiceFor(s.scenario, schoolToday);
    await db('fee_challans').insert({
      challan_number: `TEST-${s.admissionNo}`,
      consumer_number: `97${String(studentId).padStart(8, '0')}`,
      session_id: session.id,
      class_id: classRow.id,
      student_id: studentId,
      grace_period_days: 5,
      late_fee_amount: 0,
      ...inv
    });
    created.push({ ...s, studentId, invoice: inv });
  }

  // Lessons for timezone testing (stored as school wall-clock time, like publishTimetable does)
  if (subject && teacher) {
    const lessons = [
      { date: schoolToday, start: '17:00', end: '17:45', topic: '5:00 PM Pakistan class (today)' },
      { date: addDays(schoolToday, 1), start: '03:00', end: '03:45', topic: '3:00 AM Pakistan class (UK sees previous day)' },
      { date: addDays(schoolToday, 4), start: '17:00', end: '17:45', topic: '5:00 PM Pakistan class (+4 days)' }
    ];
    for (const l of lessons) {
      await db('timetable_lessons').insert({
        slot_id: null,
        class_id: classRow.id,
        subject_id: subject.id,
        teacher_id: teacher.id,
        lesson_date: l.date,
        start_at: `${l.date} ${l.start}:00`,
        end_at: `${l.date} ${l.end}:00`,
        status: 'SCHEDULED',
        topic_covered: `${LESSON_MARKER} ${l.topic}`
      });
    }
  }

  return { created, classRow, schoolToday, lessonsCreated: Boolean(subject && teacher) };
}

async function main() {
  const removed = await clean();
  if (process.argv.includes('--clean')) {
    console.log(`Removed test data (${removed} test users).`);
    return;
  }
  const { created, classRow, schoolToday, lessonsCreated } = await seed();

  console.log(`\nFee/timezone test data created (school date ${schoolToday}, ${config.SCHOOL_TIMEZONE}).`);
  console.log(`Class: ${classRow.name} (id ${classRow.id})   Password for all test students: ${PASSWORD}\n`);
  console.table(
    created.map((c) => ({
      login: c.username,
      studentId: c.studentId,
      invoice: c.invoice.billing_month,
      status: c.invoice.status,
      outstanding: c.invoice.total_payable - c.invoice.paid_amount,
      graceEnds: c.invoice.valid_until,
      expected: { overdue: 'RESTRICTED', partial: 'RESTRICTED', grace: 'allowed', paid: 'allowed', exempt: 'allowed' }[
        c.scenario
      ]
    }))
  );
  if (!lessonsCreated) console.log('No subject/teacher found - timetable test lessons were not created.');
  console.log('\nNext: run "npm run fees:run" (or restart the backend) to apply restrictions.\n');
}

main()
  .catch((err) => {
    console.error('Failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => db.destroy());
