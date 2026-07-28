-- Self-service "forgot password" for both members and admin accounts.
-- A 6-digit code is emailed and must be entered before a new password can
-- be set — unlike the existing admin-triggered "reset password" actions
-- (which immediately overwrite the password_hash), this is a public,
-- unauthenticated endpoint, so the password itself is never changed on mere
-- request; only submitting the correct code actually changes it.
create table password_reset_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  admin_id uuid references admins(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint password_reset_codes_owner_check check (
    (user_id is not null and admin_id is null) or (user_id is null and admin_id is not null)
  )
);

create index password_reset_codes_user_id_idx on password_reset_codes(user_id);
create index password_reset_codes_admin_id_idx on password_reset_codes(admin_id);
