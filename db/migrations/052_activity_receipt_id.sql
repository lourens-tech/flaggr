-- Reward Activity: "Receipt scanned" rows open their receipt (2026-11-24).
-- Owner decision for the 1.1.0 member app: tapping a "Receipt scanned" row in
-- Reward Activity opens that receipt in Receipt History. The row now records
-- which receipt earned it. Written by the member's own scan
-- (api/receipts/index.ts) and by an admin approving a flagged receipt
-- (applyApprovalEffects in api/_lib/fraudChecks.ts); every other row (bonuses,
-- redemptions, rejections, gifts) leaves it null.
--
-- Rows written before this migration stay null: there is no exact way to tell
-- which receipt an old row came from, so they are not guessed at.
--
-- The API checks for this column (api/_lib/activityReceiptLink.ts) and keeps
-- working without it, so this can be applied before or after the deploy.
alter table activity add column if not exists receipt_id uuid references receipts(id) on delete set null;

create index if not exists activity_receipt_id_idx on activity(receipt_id);
