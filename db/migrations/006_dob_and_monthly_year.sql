-- Adds the date of birth field (collected at signup but never persisted
-- until now) and scopes monthly_points per calendar year so multi-year
-- accounts don't blend different years' totals into the same 12 buckets.
alter table users add column if not exists date_of_birth date;

alter table monthly_points add column if not exists year integer not null default extract(year from now())::integer;
alter table monthly_points drop constraint if exists monthly_points_pkey;
alter table monthly_points add primary key (user_id, year, month);
