-- Seeds the first (and currently only) signed-up course, matching the
-- rewards shown in the mock data the app previously shipped with.

insert into courses (name, slug)
values ('Strand Golf Club', 'strand-golf-club')
on conflict (slug) do nothing;

with ins as (
  insert into rewards (course_id, title, description, image_url, category)
  select c.id, r.title, r.description, r.image_url, r.category
  from courses c
  cross join (values
    ('18 Hole Round', 'Play a full 18 holes at Strand Golf Club.', 'https://flagrr-loyalty.vercel.app/rewards/18-hole-round.jpg', 'rounds'),
    ('9 Hole Round', 'Play 9 holes at Strand Golf Club.', 'https://flagrr-loyalty.vercel.app/rewards/9-hole-round.jpg', 'rounds'),
    ('Golf Cart Hire', 'Half-day golf cart hire.', 'https://flagrr-loyalty.vercel.app/rewards/golf-cart-hire.jpg', 'experiences'),
    ('1 Hour Driving Range', 'One hour practice session on the driving range.', 'https://flagrr-loyalty.vercel.app/rewards/driving-range.jpg', 'practice'),
    ('Coaching Session', 'One-on-one session with the club pro.', 'https://flagrr-loyalty.vercel.app/rewards/coaching-session.jpg', 'experiences'),
    ('Pro Shop Voucher', 'Redeemable credit to spend in the pro shop.', 'https://flagrr-loyalty.vercel.app/rewards/pro-shop-voucher.jpg', 'pro-shop'),
    ('Kitchen Voucher', 'Redeemable credit to spend at the clubhouse kitchen.', 'https://flagrr-loyalty.vercel.app/rewards/kitchen-voucher.jpg', 'dining'),
    ('Bar Voucher', 'Redeemable credit to spend at the clubhouse bar.', 'https://flagrr-loyalty.vercel.app/rewards/bar-voucher.jpg', 'dining')
  ) as r(title, description, image_url, category)
  where c.slug = 'strand-golf-club'
  and not exists (select 1 from rewards ex where ex.course_id = c.id and ex.title = r.title)
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

-- Strand Golf Club as a recognized merchant, so receipts scanned there match
-- to the tenant course automatically.
insert into merchants (name, aliases, merchant_type, course_id)
select 'Strand Golf Club', array['strand golf club', 'strand gc'], 'golf_course', c.id
from courses c
where c.slug = 'strand-golf-club'
on conflict do nothing;

-- Starter golf product/activity catalog for the receipt scanner's points engine.
insert into golf_products (name, brand, category, aliases, points_value, points_per_unit)
values
  ('Titleist Pro V1 Golf Balls', 'Titleist', 'balls', array['pro v1', 'pro v1 dz', 'titleist pro v1 dozen'], 50, true),
  ('Callaway Chrome Tour Golf Balls', 'Callaway', 'balls', array['chrome tour', 'chrome tour dz'], 45, true),
  ('TaylorMade TP5 Golf Balls', 'TaylorMade', 'balls', array['tp5', 'tp5 dz', 'tp5 dozen'], 50, true),
  ('FootJoy Glove', 'FootJoy', 'apparel', array['fj glove', 'footjoy golf glove'], 20, true),
  ('Golf Towel', '', 'accessories', array['golf towel', 'caddy towel'], 15, true),
  ('Golf Cap', '', 'apparel', array['golf hat', 'golf visor'], 15, true)
on conflict do nothing;

insert into golf_activities (name, category, aliases, points_value)
values
  ('18 Hole Round', 'rounds', array['18 hole green fee', '18 holes', '18 hole round'], 100),
  ('9 Hole Round', 'rounds', array['9 hole green fee', '9 holes', '9 hole round'], 50),
  ('Twilight Round', 'rounds', array['twilight golf', 'twilight round'], 60),
  ('Driving Range Session', 'practice', array['range session', 'bucket of balls', 'driving range'], 30),
  ('Golf Cart Hire', 'services', array['cart hire', 'golf cart', 'cart rental'], 20),
  ('Club Rental', 'services', array['club hire', 'club rental'], 20),
  ('Caddie Fee', 'services', array['caddie fee', 'caddy fee'], 25),
  ('Golf Lesson', 'coaching', array['golf lesson', 'lesson', 'coaching session'], 80),
  ('Competition Entry', 'events', array['competition entry', 'tournament registration', 'tournament entry'], 70)
on conflict do nothing;
