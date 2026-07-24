-- A null course_id on an ad means it's shown to every course's members —
-- a "global" ad a super_admin sets across the whole platform, instead of
-- one specific club's ad. Existing ads all keep their current course_id
-- (nothing becomes global just by running this).

alter table ads alter column course_id drop not null;
