-- Sign-in audit trail and lockout (2026-11-20).
-- Every member and admin sign-in attempt (success, wrong password, or blocked)
-- is recorded here. The API counts recent failures to lock out password
-- guessing, and the rows let the owner trace where sign-ins came from (IP
-- address and device).
--
-- As in password_reset_events (050), the email address or username typed in
-- is never stored, only a SHA-256 hash of it, so the lockout also works for
-- addresses that have no account. user_id / admin_id are filled when the
-- identifier matched an account.
create table if not exists login_events (
  id uuid primary key default gen_random_uuid(),
  account_type text not null check (account_type in ('member', 'admin')),
  event text not null check (event in ('login_succeeded', 'login_failed', 'login_blocked')),
  identifier_hash text not null,
  user_id uuid references users(id) on delete set null,
  admin_id uuid references admins(id) on delete set null,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists login_events_identifier_idx on login_events(identifier_hash, created_at);
create index if not exists login_events_ip_idx on login_events(ip, created_at);

-- Super-admin and support-agent sessions now end after 12 idle hours (7 days
-- at most); new ones get that expiry at sign-in. Bring sessions that already
-- exist into line instead of letting them run out their 30 days.
update admin_sessions s set expires_at = least(s.expires_at, now() + interval '12 hours')
from admins a
where a.id = s.admin_id and a.role in ('super_admin', 'support_agent');
