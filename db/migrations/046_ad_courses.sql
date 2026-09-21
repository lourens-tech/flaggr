-- Multi-course ad targeting: an ad can target every club (is_global) or a
-- specific set of clubs (rows in ad_courses), instead of the old
-- one-course-or-null model on ads.course_id. See saveAdForSuperAdmin /
-- listAdsForCourse in api/admin/index.ts.
alter table ads add column if not exists is_global boolean not null default false;
update ads set is_global = true where course_id is null;

create table if not exists ad_courses (
  ad_id uuid not null references ads(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  primary key (ad_id, course_id)
);
create index if not exists ad_courses_course_id_idx on ad_courses(course_id);

-- Backfill: every existing single-course ad becomes a one-row ad_courses
-- membership. ads.course_id itself is left in place (still written for the
-- single-course case, see saveAd in api/admin/index.ts) rather than dropped,
-- since it's harmless and avoids touching every other read site at once.
insert into ad_courses (ad_id, course_id)
select id, course_id from ads where course_id is not null
on conflict do nothing;
