-- Groundwork for the course-admin build: fields the "Course Profile" screen
-- edits, and tracking for who/when a voucher was redeemed at the till so
-- reporting can show it. See api/admin/index.ts.

alter table courses add column if not exists contact_email citext;
alter table courses add column if not exists contact_phone text;
alter table courses add column if not exists address text;

alter table vouchers add column if not exists redeemed_at timestamptz;
alter table vouchers add column if not exists redeemed_by_admin_id uuid references admins(id) on delete set null;

create index if not exists admin_sessions_admin_id_idx on admin_sessions(admin_id);
