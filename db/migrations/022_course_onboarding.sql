-- Tracks whether a course admin has finished the first-login setup wizard
-- (course details, logo, cover photo). Null means "not yet completed" —
-- the mobile app shows the wizard once per login session until this is set,
-- and a "Finish setting up" banner on Course Profile until it's set for good.

alter table courses add column if not exists onboarding_completed_at timestamptz;

-- Every course that already exists as of this migration predates the wizard
-- and is presumably already in active use — backfill them as "onboarded" so
-- the wizard doesn't retroactively pop up for existing course admins. Only
-- courses created after this point (which get NULL by default, since new
-- inserts don't set this column) should see it.
update courses set onboarding_completed_at = now() where onboarding_completed_at is null;
