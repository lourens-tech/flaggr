-- View ledger for ad performance reporting — mirrors ad_clicks, but logs
-- every time an ad is actually shown to a member (not just tapped), so
-- click-through-rate (clicks / impressions) can finally be reported instead
-- of just raw click counts.
create table if not exists ad_impressions (
  id uuid primary key default gen_random_uuid(),
  ad_id uuid not null references ads(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  viewed_at timestamptz not null default now()
);

create index if not exists ad_impressions_ad_id_idx on ad_impressions(ad_id);
