-- Lets a super_admin scope a broadcast to one specific club (its members,
-- a tier within it, or just that club's course_admin) instead of only
-- platform-wide or every course_admin. Null means platform-wide, unchanged
-- from before this migration.
alter table super_admin_broadcasts add column course_id uuid references courses(id) on delete set null;
create index super_admin_broadcasts_course_id_idx on super_admin_broadcasts(course_id);
