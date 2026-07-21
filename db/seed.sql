-- Seeds the first (and currently only) signed-up course, matching the
-- rewards shown in the mock data the app previously shipped with.

insert into courses (name, slug)
values ('Strand Golf Club', 'strand-golf-club')
on conflict (slug) do nothing;

insert into rewards (course_id, title, description, image_url, cost, category)
select c.id, r.title, r.description, r.image_url, r.cost, r.category
from courses c
cross join (values
  ('9 Holes Round', 'Play 9 holes at Strand Golf Club.', 'https://images.unsplash.com/photo-1587174786738-5699a41ba0c2?w=600', 500, 'rounds'),
  ('18 Holes Round', 'Play a full 18 holes at Strand Golf Club.', 'https://images.unsplash.com/photo-1592919505780-303950717480?w=600', 900, 'rounds'),
  ('Bucket of Balls', 'Practice range session, one large bucket.', 'https://images.unsplash.com/photo-1600275669439-14e40452d20b?w=600', 150, 'practice'),
  ('Pro Shop Voucher', 'R250 credit to spend in the pro shop.', 'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=600', 700, 'pro-shop'),
  ('Golf Cart Hire', 'Half-day golf cart hire.', 'https://images.unsplash.com/photo-1622396481328-9c2d1c495a01?w=600', 400, 'experiences'),
  ('Coaching Session', 'One-on-one session with the club pro.', 'https://images.unsplash.com/photo-1591491634026-3b8fd18de4a2?w=600', 1200, 'experiences')
) as r(title, description, image_url, cost, category)
where c.slug = 'strand-golf-club'
on conflict do nothing;

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
