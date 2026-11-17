-- Read-only: shows which migrations from 025 onward are present on a database. Add a row for each new migration.
with checks(migration, tbl, col) as (values
  ('025','support_tickets',null), ('026','member_roster',null), ('027','super_admin_broadcasts',null),
  ('029','audit_log',null), ('030','courses','archived_at'), ('031','receipt_duplicate_attempts',null),
  ('032','password_reset_codes',null), ('033','receipts','image_data'), ('034','receipts','fraud_status'),
  ('035','support_tickets','priority'), ('036','support_tickets','assigned_agent_id'),
  ('037','users','notify_account_activity'), ('038','ads','media_type'), ('039','courses','payfast_token'),
  ('040','receipts','points_credited'), ('041','ad_impressions',null), ('042','golf_products','rand_value'),
  ('043','courses','is_placeholder'), ('044','support_tickets','category'), ('045','referral_redemptions',null),
  ('046','ad_courses',null), ('047','receipt_scan_cache',null), ('048','golf_courses',null),
  ('049','golf_profiles','share_with_club'))
select migration, tbl || coalesce('.' || col, '') as checks_for,
  case when col is null then to_regclass('public.' || tbl) is not null
       else exists (select 1 from information_schema.columns c
                    where c.table_schema = 'public' and c.table_name = checks.tbl and c.column_name = checks.col)
  end as present
from checks order by migration;

-- STEP 2: fix the Support inbox (migrations 035, 036 and 044). Safe to run more than once.
alter table support_tickets
  add column if not exists priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent'));
create index if not exists support_tickets_priority_idx on support_tickets(priority);
alter table support_tickets
