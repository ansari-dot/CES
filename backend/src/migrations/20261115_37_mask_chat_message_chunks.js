/**
 * Migration to sanitize and mask historical phone numbers and number chunks
 * stored in chat_messages table.
 */
export async function up(knex) {
  const hasTable = await knex.schema.hasTable('chat_messages');
  if (!hasTable) return;

  const messages = await knex('chat_messages').select('id', 'content');
  for (const m of messages) {
    if (!m.content) continue;
    const trimmed = m.content.trim();

    // Mask Pakistani mobile prefixes, 3+ digit standalone chunks, or pure digit messages
    const isPureDigits = /^\d{2,15}$/.test(trimmed);
    const hasPhonePrefix = /\b(0092|92|\+92|03)\d{1,9}\b/.test(trimmed);
    const hasStandaloneDigits = /\b\d{3,15}\b/.test(trimmed);
    const hasSpacedDigits = /(?:\d[\s\-.()]{0,3}){3,}\d/.test(trimmed);

    if (isPureDigits || hasPhonePrefix || hasStandaloneDigits || hasSpacedDigits) {
      let masked = trimmed
        .replace(/\b(0092|92|\+92|03)\d{1,9}\b/g, (s) => '*'.repeat(s.length))
        .replace(/\b\d{3,}\b/g, (s) => '*'.repeat(s.length))
        .replace(/(?:\d[\s\-.()]{0,3}){3,}\d/g, (s) => s.replace(/\d/g, '*'));

      if (isPureDigits) {
        masked = '*'.repeat(trimmed.length);
      }

      if (masked !== m.content) {
        await knex('chat_messages').where({ id: m.id }).update({
          content: masked,
          was_masked: 1,
          has_policy_violation: 1,
          policy_violation_type: 'PHONE_NUMBER_CHUNK'
        });
      }
    }
  }
}

export async function down() {}
