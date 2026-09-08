-- Lets a member finish sign-up even when their own golf club hasn't joined
-- Flagrr yet, instead of the required "Golf Club" field having nothing to
-- select. A single sentinel course row (not a real, billable tenant — no
-- admin, no reward catalog) that the sign-up picker offers as a last resort
-- and the app can recognise via is_placeholder, rather than a whole
-- imported directory of unclaimed clubs: that would risk a real club
-- signing up later and getting a second, duplicate course row instead of
-- claiming this one, stranding any members who joined in the meantime.
-- See api/courses/index.ts (GET), api/me.ts, SignUpStep1Screen.tsx,
-- HomeScreen.tsx, and RewardsShopScreen.tsx.
alter table courses add column if not exists is_placeholder boolean not null default false;

insert into courses (name, slug, is_placeholder)
values ('My Club Isn''t Listed Yet', 'not-listed-yet', true)
on conflict (slug) do nothing;
