-- Reworks the rewards catalog to support multiple selectable denominations
-- per reward (e.g. Pro Shop Voucher: R1000/R750/R500/R250), each priced in
-- Flagrr Bucks at a per-course Rand conversion rate. Run this whole file
-- once against the already-provisioned database.
--
-- This clears existing rewards/vouchers and reseeds the catalog described by
-- the club (Strand Golf Club) — safe for the current pre-launch test data,
-- but destructive to any real redemption history, so don't re-run in prod
-- once live vouchers exist.

alter table courses add column if not exists fb_per_rand numeric not null default 2.8;

create table if not exists reward_variants (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references rewards(id) on delete cascade,
  label text not null, -- e.g. 'R500', or 'Standard' for non-voucher rewards
  rand_value integer check (rand_value >= 0), -- null for rewards with no Rand equivalent (e.g. a round of golf)
  cost integer not null check (cost >= 0), -- Flagrr Bucks; admin enters rand_value, this = rand_value * fb_per_rand
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists reward_variants_reward_id_idx on reward_variants(reward_id);

alter table vouchers add column if not exists reward_variant_id uuid references reward_variants(id);
alter table vouchers add column if not exists variant_label text not null default '';
alter table vouchers add column if not exists cost integer not null default 0;

-- Old rewards had a flat cost column; that's now on reward_variants instead.
delete from vouchers;
delete from rewards;
alter table rewards drop column if exists cost;

alter table rewards drop constraint if exists rewards_category_check;
alter table rewards add constraint rewards_category_check
  check (category in ('rounds', 'experiences', 'pro-shop', 'practice', 'dining'));

with ins as (
  insert into rewards (course_id, title, description, image_url, category)
  select c.id, r.title, r.description, r.image_url, r.category
  from courses c
  cross join (values
    ('18 Hole Round', 'Play a full 18 holes at Strand Golf Club.', 'https://images.unsplash.com/photo-1592919505780-303950717480?w=600', 'rounds'),
    ('9 Hole Round', 'Play 9 holes at Strand Golf Club.', 'https://images.unsplash.com/photo-1587174786738-5699a41ba0c2?w=600', 'rounds'),
    ('Golf Cart Hire', 'Half-day golf cart hire.', 'https://images.unsplash.com/photo-1622396481328-9c2d1c495a01?w=600', 'experiences'),
    ('1 Hour Driving Range', 'One hour practice session on the driving range.', 'https://images.unsplash.com/photo-1600275669439-14e40452d20b?w=600', 'practice'),
    ('Coaching Session', 'One-on-one session with the club pro.', 'https://images.unsplash.com/photo-1591491634026-3b8fd18de4a2?w=600', 'experiences'),
    ('Pro Shop Voucher', 'Redeemable credit to spend in the pro shop.', 'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=600', 'pro-shop'),
    ('Kitchen Voucher', 'Redeemable credit to spend at the clubhouse kitchen.', 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600', 'dining'),
    ('Bar Voucher', 'Redeemable credit to spend at the clubhouse bar.', 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=600', 'dining')
  ) as r(title, description, image_url, category)
  where c.slug = 'strand-golf-club'
  returning id, title
)
insert into reward_variants (reward_id, label, rand_value, cost, sort_order)
select ins.id, v.label, v.rand_value, v.cost, v.sort_order
from ins
join (values
  ('18 Hole Round', 'Standard', null::integer, 900, 0),
  ('9 Hole Round', 'Standard', null::integer, 500, 0),
  ('Golf Cart Hire', 'Standard', null::integer, 400, 0),
  ('1 Hour Driving Range', 'Standard', null::integer, 150, 0),
  ('Coaching Session', 'Standard', null::integer, 1200, 0),
  ('Pro Shop Voucher', 'R1000', 1000, 2800, 0),
  ('Pro Shop Voucher', 'R750', 750, 2100, 1),
  ('Pro Shop Voucher', 'R500', 500, 1400, 2),
  ('Pro Shop Voucher', 'R250', 250, 700, 3),
  ('Kitchen Voucher', 'R250', 250, 700, 0),
  ('Kitchen Voucher', 'R200', 200, 560, 1),
  ('Kitchen Voucher', 'R150', 150, 420, 2),
  ('Kitchen Voucher', 'R100', 100, 280, 3),
  ('Kitchen Voucher', 'R50', 50, 140, 4),
  ('Bar Voucher', 'R1000', 1000, 2800, 0),
  ('Bar Voucher', 'R750', 750, 2100, 1),
  ('Bar Voucher', 'R500', 500, 1400, 2),
  ('Bar Voucher', 'R250', 250, 700, 3),
  ('Bar Voucher', 'R200', 200, 560, 4),
  ('Bar Voucher', 'R150', 150, 420, 5),
  ('Bar Voucher', 'R100', 100, 280, 6),
  ('Bar Voucher', 'R50', 50, 140, 7)
) as v(title, label, rand_value, cost, sort_order) on v.title = ins.title;
