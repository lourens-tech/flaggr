-- Holds the extraction from a receipt's scan preview so the confirm step
-- reuses exactly what the member was shown instead of reading the photo a
-- second time (a vision model can read the same photo slightly differently
-- each time, which would change the points between preview and confirm).
-- Written only by the server from its own extraction, keyed by the member
-- and the photo's hash, and short-lived — see api/_lib/scanCache.ts.
create table if not exists receipt_scan_cache (
  user_id uuid not null references users(id) on delete cascade,
  image_hash text not null,
  extractor text not null,
  parsed jsonb not null,
  confidence numeric not null,
  created_at timestamptz not null default now(),
  primary key (user_id, image_hash)
);
create index if not exists receipt_scan_cache_created_at_idx on receipt_scan_cache(created_at);
