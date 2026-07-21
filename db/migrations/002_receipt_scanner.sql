-- Receipt (slip) scanner: merchants, golf products/activities catalogs,
-- per-line-item matching, and fraud/duplicate-detection columns on receipts.
-- Run this whole file once against the already-provisioned database.

create table if not exists merchants (
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

create table if not exists golf_products (
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

create table if not exists golf_activities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default '',
  aliases text[] not null default '{}',
  points_value integer not null default 0,
  active boolean not null default true
);

-- Extend receipts with everything the scanner needs to identify, dedupe, and
-- audit a scan. receipt_number is unique so the same slip can never be
-- redeemed twice, by anyone.
alter table receipts add column if not exists receipt_number text;
alter table receipts add column if not exists merchant_id uuid references merchants(id);
alter table receipts add column if not exists transaction_number text;
alter table receipts add column if not exists till_number text;
alter table receipts add column if not exists receipt_time text;
alter table receipts add column if not exists image_hash text;
alter table receipts add column if not exists ocr_confidence numeric;
alter table receipts add column if not exists flagged boolean not null default false;
alter table receipts add column if not exists flag_reason text;

create unique index if not exists receipts_receipt_number_unique_idx
  on receipts(receipt_number) where receipt_number is not null;
-- Unique (not just indexed) so the insert itself is the atomic duplicate
-- check — no race between a pre-check SELECT and the INSERT.
create unique index if not exists receipts_image_hash_unique_idx
  on receipts(image_hash) where image_hash is not null;
create index if not exists receipts_merchant_id_idx on receipts(merchant_id);

create table if not exists receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references receipts(id) on delete cascade,
  description text not null,
  quantity numeric not null default 1,
  price numeric not null default 0,
  matched_product_id uuid references golf_products(id),
  matched_activity_id uuid references golf_activities(id),
  points_awarded integer not null default 0
);
create index if not exists receipt_items_receipt_id_idx on receipt_items(receipt_id);

alter table user_stats add column if not exists total_receipts_scanned integer not null default 0;
alter table user_stats add column if not exists last_scan_date timestamptz;

-- Strand Golf Club as a recognized merchant, so receipts scanned there match
-- to the tenant course automatically.
insert into merchants (name, aliases, merchant_type, course_id)
select 'Strand Golf Club', array['strand golf club', 'strand gc'], 'golf_course', c.id
from courses c
where c.slug = 'strand-golf-club'
and not exists (select 1 from merchants m where m.name = 'Strand Golf Club');

-- Starter catalog (from the product spec's own examples). Safe to run more
-- than once — de-duplicated by name.
insert into golf_products (name, brand, category, aliases, points_value, points_per_unit)
select * from (values
  ('Titleist Pro V1 Golf Balls', 'Titleist', 'balls', array['pro v1', 'pro v1 dz', 'titleist pro v1 dozen'], 50, true),
  ('Callaway Chrome Tour Golf Balls', 'Callaway', 'balls', array['chrome tour', 'chrome tour dz'], 45, true),
  ('TaylorMade TP5 Golf Balls', 'TaylorMade', 'balls', array['tp5', 'tp5 dz', 'tp5 dozen'], 50, true),
  ('FootJoy Glove', 'FootJoy', 'apparel', array['fj glove', 'footjoy golf glove'], 20, true),
  ('Golf Towel', '', 'accessories', array['golf towel', 'caddy towel'], 15, true),
  ('Golf Cap', '', 'apparel', array['golf hat', 'golf visor'], 15, true)
) as v(name, brand, category, aliases, points_value, points_per_unit)
where not exists (select 1 from golf_products gp where gp.name = v.name);

insert into golf_activities (name, category, aliases, points_value)
select * from (values
  ('18 Hole Round', 'rounds', array['18 hole green fee', '18 holes', '18 hole round'], 100),
  ('9 Hole Round', 'rounds', array['9 hole green fee', '9 holes', '9 hole round'], 50),
  ('Twilight Round', 'rounds', array['twilight golf', 'twilight round'], 60),
  ('Driving Range Session', 'practice', array['range session', 'bucket of balls', 'driving range'], 30),
  ('Golf Cart Hire', 'services', array['cart hire', 'golf cart', 'cart rental'], 20),
  ('Club Rental', 'services', array['club hire', 'club rental'], 20),
  ('Caddie Fee', 'services', array['caddie fee', 'caddy fee'], 25),
  ('Golf Lesson', 'coaching', array['golf lesson', 'lesson', 'coaching session'], 80),
  ('Competition Entry', 'events', array['competition entry', 'tournament registration', 'tournament entry'], 70)
) as v(name, category, aliases, points_value)
where not exists (select 1 from golf_activities ga where ga.name = v.name);
