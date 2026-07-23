-- Admin-facing notification feed — scoped to a course (not an individual
-- admin), since any course_admin for that club should see the same feed.
-- First and only trigger for now: a receipt getting flagged by the fraud
-- heuristics at submit time (see api/_lib/fraudChecks.ts) — see
-- api/receipts/index.ts and api/admin/index.ts.
create table if not exists admin_notifications (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  title text not null,
  body text not null,
  receipt_id uuid references receipts(id) on delete set null,
  date timestamptz not null default now(),
  read boolean not null default false
);

create index if not exists admin_notifications_course_id_idx on admin_notifications(course_id);
