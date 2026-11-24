import { hasColumn } from './schemaColumns';

// activity.receipt_id (db/migrations/052_activity_receipt_id.sql) links a
// "Receipt scanned" row to the receipt that earned it, so the member app can
// open that receipt from Reward Activity. Until the migration is applied the
// API keeps working without the link: inserts leave it out and the activity
// list returns receiptId: null (see schemaColumns.ts).
export function activityHasReceiptId(): Promise<boolean> {
  return hasColumn('activity', 'receipt_id', '052_activity_receipt_id.sql');
}
