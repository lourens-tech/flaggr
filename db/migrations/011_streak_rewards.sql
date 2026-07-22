-- Idempotency ledger for streak milestone bonuses — see
-- api/_lib/streakRewards.ts. Keyed by (user_id, active_since, weeks) rather
-- than just (user_id, weeks) so a streak that breaks and later restarts can
-- earn the same milestone again, while repeated GET /api/me calls during a
-- single ongoing streak don't double-grant it.
create table if not exists streak_rewards_granted (
  user_id uuid not null references users(id) on delete cascade,
  active_since date not null,
  weeks integer not null,
  amount integer not null,
  granted_at timestamptz not null default now(),
  primary key (user_id, active_since, weeks)
);
