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
  bucks_redeemed_delta_pct numeric not null default 0,
  total_receipts_scanned integer not null default 0,
  last_scan_date timestamptz
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

create table merchants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  aliases text[] not null default '{}',
  merchant_type text not null default 'retailer'
    check (merchant_type in ('golf_course', 'pro_shop', 'driving_range', 'retailer', 'academy', 'clubhouse', 'online_retailer')),
  course_id uuid references courses(id), -- set when this merchant is also one of our signed-up tenant clubs
  bonus_multiplier numeric not null default 1, -- merchant-specific promo, e.g. 2 = double points
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table golf_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text not null default '',
  category text not null default '',
  sku text,
  barcode text,
  aliases text[] not null default '{}',
  points_value integer not null default 0,
  points_per_unit boolean not null default true, -- true: points_value * quantity, false: flat regardless of quantity
  active boolean not null default true
);

create table golf_activities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default '',
  aliases text[] not null default '{}',
  points_value integer not null default 0,
  active boolean not null default true
);

create table receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  course_id uuid not null references courses(id), -- member's home club, for tenant scoping/reporting
  course_name text not null default '', -- free-text: where the receipt is actually from (may not be a signed-up course)
  image_uri text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  items jsonb not null default '[]',
  subtotal numeric not null default 0,
  tax numeric not null default 0,
  total numeric not null default 0,
  submitted_at timestamptz not null default now(),
  points_awarded integer,
  receipt_number text,
  merchant_id uuid references merchants(id),
  transaction_number text,
  till_number text,
  receipt_time text,
  image_hash text,
  ocr_confidence numeric,
  flagged boolean not null default false,
  flag_reason text
);

create table receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references receipts(id) on delete cascade,
  description text not null,
  quantity numeric not null default 1,
  price numeric not null default 0,
  matched_product_id uuid references golf_products(id),
  matched_activity_id uuid references golf_activities(id),
  points_awarded integer not null default 0
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
create unique index receipts_receipt_number_unique_idx on receipts(receipt_number) where receipt_number is not null;
create unique index receipts_image_hash_unique_idx on receipts(image_hash) where image_hash is not null;
create index receipts_merchant_id_idx on receipts(merchant_id);
create index receipt_items_receipt_id_idx on receipt_items(receipt_id);
