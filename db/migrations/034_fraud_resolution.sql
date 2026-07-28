-- Lets a super_admin or course_admin resolve a flagged receipt: either
-- confirm it as fraud (rejects the receipt; the app then claws back the
-- points it awarded) or clear it as a false positive (leaves the receipt
-- and points untouched, just closes it out of the review queue).
alter table receipts
  add column fraud_status text not null default 'pending' check (fraud_status in ('pending', 'confirmed', 'cleared')),
  add column fraud_resolved_at timestamptz,
  add column fraud_resolved_by uuid references admins(id) on delete set null;

-- Repeat-offender counter, distinct from the existing "times flagged" count
-- (which includes false positives) — only increments on a confirmed fraud.
alter table users
  add column fraud_confirmed_count integer not null default 0;
