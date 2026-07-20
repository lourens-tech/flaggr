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
