-- Golf products/activities used to be a single global catalog, manually
-- seeded once via raw SQL, with a hand-set points_value that had no
-- relationship to what the item is actually worth in Rand or to the club's
-- own Flagrr Cash conversion rate — it drifted out of sync with reality
-- immediately (e.g. an "18 Hole Round" staying at 100 points forever,
-- regardless of what the club charges or its own fb_per_rand). Both tables
-- now belong to a specific club and store a Rand value instead, scored the
-- same way reward_variants already are: points = rand_value * that club's
-- own fb_per_rand (see api/_lib/pointsEngine.ts).
alter table golf_products add column if not exists course_id uuid references courses(id);
alter table golf_products add column if not exists rand_value integer not null default 0;
alter table golf_activities add column if not exists course_id uuid references courses(id);
alter table golf_activities add column if not exists rand_value integer not null default 0;

-- Attach the existing seeded catalog to Strand Golf Club (the only club that
-- had one) as an editable starting point — rough Rand values stand in until
-- the club corrects them via the new catalog screen.
update golf_products set course_id = c.id
  from courses c
  where golf_products.course_id is null and c.slug = 'strand-golf-club';
update golf_activities set course_id = c.id
  from courses c
  where golf_activities.course_id is null and c.slug = 'strand-golf-club';

update golf_products set rand_value = case name
  when 'Titleist Pro V1 Golf Balls' then 900
  when 'Callaway Chrome Tour Golf Balls' then 850
  when 'TaylorMade TP5 Golf Balls' then 900
  when 'FootJoy Glove' then 250
  when 'Golf Towel' then 180
  when 'Golf Cap' then 220
  else rand_value
end
where rand_value = 0;

update golf_activities set rand_value = case name
  when '18 Hole Round' then 900
  when '9 Hole Round' then 480
  when 'Twilight Round' then 550
  when 'Driving Range Session' then 90
  when 'Golf Cart Hire' then 250
  when 'Club Rental' then 300
  when 'Caddie Fee' then 200
  when 'Golf Lesson' then 650
  when 'Competition Entry' then 400
  else rand_value
end
where rand_value = 0;

alter table golf_products alter column course_id set not null;
alter table golf_activities alter column course_id set not null;

create index if not exists golf_products_course_id_idx on golf_products(course_id);
create index if not exists golf_activities_course_id_idx on golf_activities(course_id);

-- Every signed-up club needs its own merchants row so the receipt scanner
-- can recognise "this slip is from our own course" regardless of where the
-- club's name actually appears on the slip. Previously only Strand (the
-- originally seeded club) had one, so any other club's receipts could never
-- be matched to their own club at all.
insert into merchants (name, aliases, merchant_type, course_id)
select c.name, array[lower(c.name)], 'golf_course', c.id
from courses c
where not exists (select 1 from merchants m where m.course_id = c.id);
