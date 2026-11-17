-- Golf on the admin dashboards: a member's club can see the rounds they play
-- on the club's own course, and the stats from them, unless the member turns
-- sharing off in My Golf. On by default (owner's decision, 2026-11-17).
-- Members with no golf_profiles row count as sharing (the API reads a
-- missing row as the default).
alter table golf_profiles add column if not exists share_with_club boolean not null default true;

-- The admin Golf pages read a club's completed rounds on its course by date.
create index if not exists golf_rounds_course_completed_idx on golf_rounds(golf_course_id, completed_at) where status = 'completed';
