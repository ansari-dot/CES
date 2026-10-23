/**
 * Run the fee lifecycle job once (the backend also runs it at startup and hourly).
 *
 *   npm run fees:run
 *   npm run fees:run -- --date 2026-11-01T09:00:00+05:00   (simulate a date)
 *
 * --date pretends "now" is that moment. It acts on ALL students' real data,
 * e.g. a date on the 1st–5th generates that month's invoices, and a date on or
 * after the 11th restricts every student with an unpaid invoice past grace.
 */

import { db } from '../src/shared/db/knex.js';
import { config } from '../src/config/index.js';
import { runFeeLifecycle } from '../src/modules/fees/fees.scheduler.js';

const idx = process.argv.indexOf('--date');
const now = idx > -1 ? new Date(process.argv[idx + 1]) : new Date();

if (Number.isNaN(now.getTime())) {
  console.error('Invalid --date. Example: --date 2026-11-01T09:00:00+05:00');
  process.exit(1);
}

console.log(`Running fee lifecycle as of ${now.toISOString()} (billing timezone ${config.SCHOOL_TIMEZONE})`);
runFeeLifecycle(now)
  .then((summary) => console.log(JSON.stringify(summary, null, 2)))
  .catch((err) => {
    console.error('Failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => db.destroy());
