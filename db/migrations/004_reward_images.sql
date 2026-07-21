-- Points each reward's image_url at the real club photos bundled with the
-- app (served statically from the same Vercel deployment, alongside the
-- API), replacing the placeholder stock photo links from migration 003.
update rewards set image_url = 'https://flagrr-loyalty.vercel.app/rewards/' || v.filename
from (values
  ('18 Hole Round', '18-hole-round.jpg'),
  ('9 Hole Round', '9-hole-round.jpg'),
  ('Golf Cart Hire', 'golf-cart-hire.jpg'),
  ('1 Hour Driving Range', 'driving-range.jpg'),
  ('Coaching Session', 'coaching-session.jpg'),
  ('Pro Shop Voucher', 'pro-shop-voucher.jpg'),
  ('Kitchen Voucher', 'kitchen-voucher.jpg'),
  ('Bar Voucher', 'bar-voucher.jpg')
) as v(title, filename)
where rewards.title = v.title;
