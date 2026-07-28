-- The existing image_uri column only ever held a local device file:// URI
-- ("kept only for on-device display" per the original comment) -- useless
-- off-device and never actually read back anywhere. This adds the actual
-- (already resized/compressed on-device before upload) image data, stored
-- the same way every other image in this app already is -- a base64 data
-- URI directly in a text column (see users.avatar_url, courses.logo_url/
-- cover_image_url, ads.image_url, rewards.image_url).
alter table receipts add column image_data text;
