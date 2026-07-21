-- Links redeem-type activity entries to the voucher they created, so the
-- Rewards Activity screen can open a still-active voucher's QR code
-- directly from its timeline entry. Run once against the already-
-- provisioned database.
alter table activity add column if not exists voucher_id uuid references vouchers(id);
create index if not exists activity_voucher_id_idx on activity(voucher_id);
