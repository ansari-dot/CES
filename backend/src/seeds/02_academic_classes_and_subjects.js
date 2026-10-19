/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function seed(knex) {
  // 1. Seed Classes 1 to 8 (SRS Section 1.4)
  for (let grade = 1; grade <= 8; grade++) {
    const existing = await knex('classes').where({ grade_level: grade }).first();
    if (!existing) {
      await knex('classes').insert({
        grade_level: grade,
        name: `Class ${grade}`,
        is_active: 1
      });
    }
  }

  // 2. Seed Academic Session
  const sessionName = '2026-27';
  let session = await knex('academic_sessions').where({ name: sessionName }).first();
  if (!session) {
    const [id] = await knex('academic_sessions').insert({
      name: sessionName,
      start_date: '2026-08-01',
      end_date: '2027-06-30',
      is_current: 1
    });
    session = { id };
  }

  // 3. Seed Core Subjects
  const subjects = [
    { code: 'MATH', name: 'Mathematics' },
    { code: 'ENG', name: 'English Language' },
    { code: 'SCI', name: 'General Science' },
    { code: 'URD', name: 'Urdu Literature' },
    { code: 'ISL', name: 'Islamic Studies' },
    { code: 'PST', name: 'Social Studies' },
    { code: 'CS', name: 'Computer Studies' },
    { code: 'ART', name: 'Creative Arts' }
  ];

  for (const sub of subjects) {
    const existing = await knex('subjects').where({ code: sub.code }).first();
    if (!existing) {
      await knex('subjects').insert({
        code: sub.code,
        name: sub.name,
        is_active: 1
      });
    }
  }

  // 4. Map subjects to each class
  const classRows = await knex('classes').select('id');
  const subjectRows = await knex('subjects').select('id');

  for (const cls of classRows) {
    for (const sub of subjectRows) {
      const exists = await knex('class_subjects').where({
        class_id: cls.id,
        subject_id: sub.id
      }).first();

      if (!exists) {
        await knex('class_subjects').insert({
          class_id: cls.id,
          subject_id: sub.id,
          is_active: 1
        });
      }
    }
  }
}
