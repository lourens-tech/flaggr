-- Groundwork for the future golf-course-admin and super-admin sides, and
-- the marketing site's "subscribe your golf course" flow. No admin
-- UI/API is built yet — this just makes sure the database is ready so
-- that work integrates cleanly when it happens.

alter table courses add column if not exists stripe_customer_id text;
alter table courses add column if not exists stripe_subscription_id text;
alter table courses add column if not exists subscription_status text
  check (subscription_status in ('trialing', 'active', 'past_due', 'canceled'));

-- Admin identities — deliberately separate from `users` (members), which
-- carries member-only concepts (tier, points, streaks) that don't apply
-- here. One table covers both roles: a course_admin is scoped to one club
-- (course_id required); a super_admin oversees every club (course_id null).
--
-- password_hash/activated_at start null: an admin is created by an invite
-- (super_admin creating a course_admin, or the future subscribe-and-pay
-- flow) which sets invite_token/invite_expires_at, emails an activation
-- link, and the activation endpoint sets password_hash + activated_at —
-- same shape as a password-reset flow, not a standing "magic link".
create table if not exists admins (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id) on delete cascade,
  role text not null check (role in ('super_admin', 'course_admin')),
  first_name text not null,
  last_name text not null default '',
  email citext not null unique,
  password_hash text,
  invite_token uuid,
  invite_expires_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  check (role <> 'course_admin' or course_id is not null)
);

create table if not exists admin_sessions (
  token uuid primary key default gen_random_uuid(),
  admin_id uuid not null references admins(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);

create index if not exists admins_course_id_idx on admins(course_id);
create unique index if not exists admins_invite_token_idx on admins(invite_token) where invite_token is not null;
create index if not exists admin_sessions_admin_id_idx on admin_sessions(admin_id);
