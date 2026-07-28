-- Adds a fourth ad placement ('home_top', a banner shown above My Stats on
-- the member Home screen, independent of the existing 'home' ad further
-- down the page) and a media_type so an ad's creative can be a gif or short
-- video instead of only a static image. Same base64-in-column storage as
-- every other image in this app (image_url just holds a bigger data URI for
-- gif/video) — no new blob storage service.
alter table ads drop constraint if exists ads_placement_check;
alter table ads add constraint ads_placement_check check (placement in ('home', 'home_top', 'rewards_shop'));

alter table ads add column if not exists media_type text not null default 'image' check (media_type in ('image', 'gif', 'video'));
