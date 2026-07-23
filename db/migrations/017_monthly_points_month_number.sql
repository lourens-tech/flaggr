-- monthly_points previously keyed rows by month LETTER ('J', 'F', ...),
-- but several months share a first letter (Jan/Jun/Jul, Mar/May, Apr/Aug),
-- so the (user_id, year, month) primary key silently merged those months'
-- totals into the same row instead of keeping them separate. Recreates the
-- table keyed by the actual calendar month number (1-12) instead. This is a
-- derived chart-cache table (the ledger of record is `activity`), and the
-- existing data is already corrupted by the collision, so there's nothing
-- worth preserving.
drop table if exists monthly_points;

create table monthly_points (
  user_id uuid not null references users(id) on delete cascade,
  year integer not null,
  month smallint not null check (month between 1 and 12),
  value integer not null default 0,
  primary key (user_id, year, month)
);
