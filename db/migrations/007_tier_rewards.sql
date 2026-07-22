-- Idempotency ledgers for the two automatic tier perks: the once-a-year
-- birthday bonus and the once-a-quarter Gold/Platinum bar voucher. A row
-- existing here means that period's reward has already been granted.

create table if not exists birthday_rewards_granted (
  user_id uuid not null references users(id) on delete cascade,
  year integer not null,
  amount integer not null,
  granted_at timestamptz not null default now(),
  primary key (user_id, year)
);

create table if not exists quarterly_tier_vouchers_granted (
  user_id uuid not null references users(id) on delete cascade,
  year integer not null,
  quarter integer not null check (quarter between 1 and 4),
  tier text not null,
  granted_at timestamptz not null default now(),
  primary key (user_id, year, quarter)
);
