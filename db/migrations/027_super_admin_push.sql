-- Extends push delivery (previously member-only) to admin accounts, so a
-- super_admin can broadcast to course_admin accounts as a group, the same
-- way a course_admin already broadcasts to their own members.
alter table push_tokens alter column user_id drop not null;
alter table push_tokens add column admin_id uuid references admins(id) on delete cascade;
alter table push_tokens add constraint push_tokens_owner_check check (
  (user_id is not null and admin_id is null) or (user_id is null and admin_id is not null)
);
create index push_tokens_admin_id_idx on push_tokens(admin_id);

-- Platform-wide broadcasts sent by a super_admin — unlike admin_broadcasts
-- (one club's course_admin messaging its own members), a super_admin isn't
-- scoped to a single course, so 'all'/tier targets here reach every member
-- across every club, and 'course_admins' reaches every course_admin account.
create table super_admin_broadcasts (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references admins(id) on delete set null,
  title text not null,
  body text not null,
  target text not null, -- 'all' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'course_admins'
  recipient_count integer not null default 0,
  sent_at timestamptz not null default now()
);
