-- Staff at the same course sometimes share one real email address (e.g. a
-- shared pro-shop inbox), so `admins.email` can no longer be globally unique
-- — it's only still unique for course_admin/super_admin, whose email *is*
-- their login. Staff instead get a system-generated `username` (unique
-- across all admins) as their login identifier; email becomes just a
-- contact address for the welcome message.

alter table admins add column if not exists username citext;

-- The original inline `email citext not null unique` constraint predates
-- staff accounts, so find and drop it by content rather than guessing
-- Postgres's auto-generated name.
do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'admins'::regclass and contype = 'u'
      and pg_get_constraintdef(oid) ilike '%email%'
  loop
    execute format('alter table admins drop constraint %I', con.conname);
  end loop;
end $$;

create unique index if not exists admins_email_unique_non_staff_idx on admins(email) where role <> 'staff';
create unique index if not exists admins_username_unique_idx on admins(username) where username is not null;
