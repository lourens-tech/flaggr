-- Flagrr multi-tenant schema.
-- A "course" is a tenant (golf club). Users belong to one course (their home
-- club); rewards belong to one course; everything else belongs to a user.

create extension if not exists pgcrypto;
create extension if not exists citext;

create table courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id),
  first_name text not null,
  last_name text not null default '',
  email citext not null unique,
  phone text,
  password_hash text not null,
  tier text not null default 'Bronze' check (tier in ('Bronze', 'Silver', 'Gold', 'Platinum')),
  avatar_url text,
  member_since timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table sessions (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);

create table points_accounts (
  user_id uuid primary key references users(id) on delete cascade,
  balance integer not null default 0,
  total_earned integer not null default 0,
  total_redeemed integer not null default 0
);

create table streaks (
  user_id uuid primary key references users(id) on delete cascade,
  weeks integer not null default 0,
  active_since timestamptz not null default now(),
  weeks_played boolean[] not null default '{}'
);

create table user_stats (
  user_id uuid primary key references users(id) on delete cascade,
  rounds_played_9 integer not null default 0,
  rounds_played_9_delta_pct numeric not null default 0,
  rounds_played_18 integer not null default 0,
  rounds_played_18_delta_pct numeric not null default 0,
  bucks_earned integer not null default 0,
  bucks_earned_delta_pct numeric not null default 0,
  bucks_redeemed integer not null default 0,
  bucks_redeemed_delta_pct numeric not null default 0
);

create table monthly_points (
  user_id uuid not null references users(id) on delete cascade,
  month text not null, -- 'J', 'F', ...
  value integer not null default 0,
  primary key (user_id, month)
);

create table rewards (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id),
  title text not null,
  description text not null default '',
  image_url text,
  cost integer not null check (cost >= 0), -- Flagrr Bucks
  category text not null check (category in ('rounds', 'experiences', 'pro-shop', 'practice')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table vouchers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  reward_id uuid not null references rewards(id),
  code text not null unique,
  status text not null default 'active' check (status in ('active', 'redeemed', 'expired')),
  qr_value text not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '90 days'
);

create table receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  course_id uuid not null references courses(id),
  image_uri text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  items jsonb not null default '[]',
  subtotal numeric not null default 0,
  tax numeric not null default 0,
  total numeric not null default 0,
  submitted_at timestamptz not null default now(),
  points_awarded integer
);

create table activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null check (type in ('earn', 'redeem')),
  title text not null,
  subtitle text not null default '',
  amount integer not null,
  date timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  body text not null,
  date timestamptz not null default now(),
  read boolean not null default false
);

create index rewards_course_id_idx on rewards(course_id);
create index users_course_id_idx on users(course_id);
create index vouchers_user_id_idx on vouchers(user_id);
create index receipts_user_id_idx on receipts(user_id);
create index activity_user_id_idx on activity(user_id);
create index notifications_user_id_idx on notifications(user_id);
create index sessions_user_id_idx on sessions(user_id);
