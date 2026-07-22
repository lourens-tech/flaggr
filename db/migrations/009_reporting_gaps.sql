-- Closes reporting gaps found while auditing the schema ahead of the
-- future admin panel: an index for course-scoped receipt reporting, and a
-- click ledger for ad performance (previously untracked entirely).

create index if not exists receipts_course_id_idx on receipts(course_id);

create table if not exists ad_clicks (
  id uuid primary key default gen_random_uuid(),
  ad_id uuid not null references ads(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  clicked_at timestamptz not null default now()
);

create index if not exists ad_clicks_ad_id_idx on ad_clicks(ad_id);
