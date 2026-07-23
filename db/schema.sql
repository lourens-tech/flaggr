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
  fb_per_rand numeric not null default 2.8, -- Flagrr Cash per R1, used to auto-price reward variants from a Rand value
  -- Billing fields for the future marketing-site "subscribe your golf
  -- course" flow (Stripe Checkout + webhook). Null for courses onboarded
  -- manually (e.g. the current seeded club) rather than through that flow.
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text check (subscription_status in ('trialing', 'active', 'past_due', 'canceled')),
  -- Editable from the course-admin "Course Profile" screen.
  contact_email citext,
  contact_phone text,
  address text,
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
  date_of_birth date,
  member_since timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table sessions (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);

-- Admin identities for the future golf-course-admin and super-admin sides —
-- deliberately separate from `users` (members), which carries member-only
-- concepts (tier, points, streaks) that don't apply here. One table covers
-- both roles: a course_admin is scoped to one club (course_id required); a
-- super_admin oversees every club (course_id null).
--
-- password_hash/activated_at start null: an admin is created by an invite
-- (super_admin creating a course_admin, or the future subscribe-and-pay
-- flow) which sets invite_token/invite_expires_at, emails an activation
-- link, and the activation endpoint sets password_hash + activated_at —
-- same shape as a password-reset flow, not a standing "magic link".
create table admins (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id) on delete cascade,
  role text not null check (role in ('super_admin', 'course_admin')),
  first_name text not null,
  last_name text not null default '',
  email citext not null unique,
  password_hash text,
  invite_token uuid,
  invite_expires_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  check (role <> 'course_admin' or course_id is not null)
);

create table admin_sessions (
  token uuid primary key default gen_random_uuid(),
  admin_id uuid not null references admins(id) on delete cascade,
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

-- rounds_played_*/bucks_*/*_delta_pct are legacy counters, no longer read —
-- /api/me computes those (and their period-over-period deltas) live from
-- activity/receipts instead, so a stale increment can never drift from
-- what's actually true. total_receipts_scanned/last_scan_date remain live.
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
  year integer not null,
  month text not null, -- 'J', 'F', ...
  value integer not null default 0,
  primary key (user_id, year, month)
);

create table rewards (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id),
  title text not null,
  description text not null default '',
  image_url text,
  category text not null check (category in ('rounds', 'experiences', 'pro-shop', 'practice', 'dining')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- A reward's redeemable options (e.g. Pro Shop Voucher: R1000/R750/R500/R250).
-- Rewards with only one option (a round of golf, a coaching session) still
-- get exactly one variant here rather than a flat cost on rewards itself.
create table reward_variants (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references rewards(id) on delete cascade,
  label text not null, -- e.g. 'R500', or 'Standard' for non-voucher rewards
  rand_value integer check (rand_value >= 0), -- null for rewards with no Rand equivalent
  cost integer not null check (cost >= 0), -- Flagrr Cash; = rand_value * courses.fb_per_rand
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table vouchers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  reward_id uuid not null references rewards(id),
  reward_variant_id uuid references reward_variants(id),
  variant_label text not null default '',
  cost integer not null default 0, -- Flagrr Cash charged, snapshotted at redemption
  code text not null unique,
  status text not null default 'active' check (status in ('active', 'redeemed', 'expired')),
  qr_value text not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '90 days',
  -- Set when course staff redeem the voucher at the till — see
  -- api/admin/index.ts (action=voucherRedeem).
  redeemed_at timestamptz,
  redeemed_by_admin_id uuid references admins(id) on delete set null
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
  voucher_id uuid references vouchers(id), -- set for redeem entries, so the timeline can open the voucher's QR code
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

-- Idempotency ledgers for the automatic tier perks (birthday bonus, once-a-
-- quarter Gold/Platinum bar voucher) — see api/_lib/tierRewards.ts.
create table birthday_rewards_granted (
  user_id uuid not null references users(id) on delete cascade,
  year integer not null,
  amount integer not null,
  granted_at timestamptz not null default now(),
  primary key (user_id, year)
);

create table quarterly_tier_vouchers_granted (
  user_id uuid not null references users(id) on delete cascade,
  year integer not null,
  quarter integer not null check (quarter between 1 and 4),
  tier text not null,
  granted_at timestamptz not null default now(),
  primary key (user_id, year, quarter)
);

-- Idempotency ledger for streak milestone bonuses — see
-- api/_lib/streakRewards.ts. Keyed by (user_id, active_since, weeks) rather
-- than just (user_id, weeks) so a streak that breaks and later restarts can
-- earn the same milestone again, while repeated GET /api/me calls during a
-- single ongoing streak don't double-grant it.
create table streak_rewards_granted (
  user_id uuid not null references users(id) on delete cascade,
  active_since date not null,
  weeks integer not null,
  amount integer not null,
  granted_at timestamptz not null default now(),
  primary key (user_id, active_since, weeks)
);

-- Expo push tokens, one row per device a member has logged in on (a token
-- is unique, so a device that later logs into a different account just
-- moves to that account). See api/_lib/pushNotifications.ts.
create table push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);

-- Ad space content — lets a future super-admin panel manage the ad
-- creative shown in the "Ad Space" slots on Home and the Rewards Shop
-- without an app release. Scoped per course, like rewards.
create table ads (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  placement text not null check (placement in ('home', 'rewards_shop')),
  title text not null default '',
  image_url text,
  target_url text,
  sort_order integer not null default 0,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Click ledger for ad performance reporting (impressions aren't tracked —
-- only taps, which is what "did this ad work" reporting needs).
create table ad_clicks (
  id uuid primary key default gen_random_uuid(),
  ad_id uuid not null references ads(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  clicked_at timestamptz not null default now()
);

create index rewards_course_id_idx on rewards(course_id);
create index ads_course_id_placement_idx on ads(course_id, placement);
create index ad_clicks_ad_id_idx on ad_clicks(ad_id);
create index reward_variants_reward_id_idx on reward_variants(reward_id);
create index users_course_id_idx on users(course_id);
create index vouchers_user_id_idx on vouchers(user_id);
create index receipts_user_id_idx on receipts(user_id);
create index receipts_course_id_idx on receipts(course_id);
create index activity_user_id_idx on activity(user_id);
create index activity_voucher_id_idx on activity(voucher_id);
create index notifications_user_id_idx on notifications(user_id);
create index sessions_user_id_idx on sessions(user_id);
create index admins_course_id_idx on admins(course_id);
create index admin_sessions_admin_id_idx on admin_sessions(admin_id);
create unique index admins_invite_token_idx on admins(invite_token) where invite_token is not null;
create index admin_sessions_admin_id_idx on admin_sessions(admin_id);
create unique index receipts_receipt_number_unique_idx on receipts(receipt_number) where receipt_number is not null;
create unique index receipts_image_hash_unique_idx on receipts(image_hash) where image_hash is not null;
create index receipts_merchant_id_idx on receipts(merchant_id);
create index receipt_items_receipt_id_idx on receipt_items(receipt_id);
create index push_tokens_user_id_idx on push_tokens(user_id);
