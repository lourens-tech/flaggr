import { sql } from './db';

// activity.receipt_id (db/migrations/052_activity_receipt_id.sql) links a
// "Receipt scanned" row to the receipt that earned it, so the member app can
// open that receipt from Reward Activity. Until the migration is applied the
// API keeps working without the link: inserts leave it out and the activity
// list returns receiptId: null. Checked once per warm instance; a missing
// column is checked again after a minute so applying the migration takes
// effect without a redeploy.
const RECHECK_MS = 60_000;
let known: { present: boolean; at: number } | null = null;

export async function activityHasReceiptId(): Promise<boolean> {
  if (known && (known.present || Date.now() - known.at < RECHECK_MS)) return known.present;
  const rows = (await sql`
    select 1 from information_schema.columns
    where table_schema = current_schema() and table_name = 'activity' and column_name = 'receipt_id'
    limit 1
  `) as unknown[];
  const present = rows.length > 0;
  if (!present) console.error('[activity] activity.receipt_id missing: apply db/migrations/052_activity_receipt_id.sql');
  known = { present, at: Date.now() };
  return present;
}
