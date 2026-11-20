-- Password-reset audit trail and throttling (2026-11-20).
-- Every "forgot password" request and every wrong reset code, for members and
-- admin accounts, is recorded here. The API counts recent rows to rate-limit
-- requests and lock out code guessing, and the rows let the owner trace who
-- is requesting resets (IP address and device) when a member reports codes
-- they didn't ask for.
--
-- The email address or username typed in is never stored, only a SHA-256 hash
-- of it, so limits work even for addresses that have no account. user_id /
-- admin_id are filled when the identifier matched an account.
create table if not exists password_reset_events (
  id uuid primary key default gen_random_uuid(),
  account_type text not null check (account_type in ('member', 'admin')),
  event text not null check (event in ('code_requested', 'request_blocked', 'code_failed', 'reset_blocked', 'password_reset')),
  identifier_hash text not null,
  user_id uuid references users(id) on delete set null,
  admin_id uuid references admins(id) on delete set null,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists password_reset_events_identifier_idx on password_reset_events(identifier_hash, created_at);
create index if not exists password_reset_events_ip_idx on password_reset_events(ip, created_at);
