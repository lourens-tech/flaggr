-- Expo push tokens, one row per device a member has logged in on (a token
-- is unique, so a device that later logs into a different account just
-- moves to that account). See api/_lib/pushNotifications.ts.
--
-- This is groundwork only — sending real push notifications requires an
-- EAS project and (for iOS) an Apple Developer account, neither of which
-- exist yet. Until then no client can ever obtain a real push token, so
-- this table stays empty and every push send is a silent no-op.
create table if not exists push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);

create index if not exists push_tokens_user_id_idx on push_tokens(user_id);
