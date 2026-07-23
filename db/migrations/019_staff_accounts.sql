-- Course-admin-managed staff accounts: a third `admins.role`, scoped to one
-- course like `course_admin`, but restricted client-side to the Vouchers tab
-- and a basic profile (see api/admin/index.ts's STAFF_ALLOWED_ACTIONS).
--
-- must_change_password: set true when a course admin creates a staff member
-- (they get a system-generated temp password by email) and cleared once the
-- staff member sets their own password — deliberately separate from the
-- pre-existing (never-built) invite_token/activated_at columns, since staff
-- can log in immediately with the temp password rather than needing to
-- complete a separate activation step first.
--
-- revoked_at: lets a course admin suspend a staff member's access without
-- deleting their record (reactivate by clearing it back to null).

alter table admins add column if not exists must_change_password boolean not null default false;
alter table admins add column if not exists revoked_at timestamptz;

-- Widen the existing role/course_id check constraints to allow 'staff'.
-- Both constraints were declared inline without explicit names, so find
-- them by content rather than guessing Postgres's auto-generated names.
do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'admins'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table admins drop constraint %I', con.conname);
  end loop;
end $$;

alter table admins add constraint admins_role_check check (role in ('super_admin', 'course_admin', 'staff'));
alter table admins add constraint admins_course_id_required_check check (role = 'super_admin' or course_id is not null);
