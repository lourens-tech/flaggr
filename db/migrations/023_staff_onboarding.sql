-- Tracks whether a course admin has finished the "invite your team" wizard
-- shown right after the course-details setup wizard. Null means "not yet
-- completed" — the mobile app shows the wizard once per login session until
-- this is set, and an "Invite your team" banner on Manage Staff until it's
-- set for good.

alter table courses add column if not exists staff_onboarding_completed_at timestamptz;

-- Every course that already exists as of this migration predates the wizard
-- and is presumably already in active use — backfill them as "done" so the
-- wizard doesn't retroactively pop up for existing course admins. Only
-- courses created after this point (which get NULL by default, since new
-- inserts don't set this column) should see it.
update courses set staff_onboarding_completed_at = now() where staff_onboarding_completed_at is null;
