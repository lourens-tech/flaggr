-- A club can upload its own membership list (course_admin, from Course
-- Profile) or a super_admin can upload one on a club's behalf (from the
-- Courses tab). A new signup is checked against their home club's roster —
-- if there's no match (or the club hasn't uploaded a list at all), the
-- member can still use the app fully, but stays capped at Bronze tier
-- forever (see api/_lib/tiers.ts) until their club verifies them.
create table member_roster (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  member_number text,
  first_name text not null,
  last_name text not null,
  email citext not null,
  created_at timestamptz not null default now()
);

create index member_roster_course_id_idx on member_roster(course_id);

-- Default true grandfathers every member who signed up before this feature
-- existed — this rollout must never retroactively strip tier progress from
-- someone already earning it. New signups explicitly compute this against
-- their club's roster (see api/auth/signup.ts) instead of relying on the
-- column default.
alter table users add column verified_member boolean not null default true;
alter table users add column verified_at timestamptz;
