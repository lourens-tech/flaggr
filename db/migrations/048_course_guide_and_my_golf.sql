-- Course Guide (hole maps + scorecard) and My Golf (stats from rounds).
--
-- golf_courses: one playable course map. club_id links it to a Flagrr club
-- (its members' home course); null for a course Flagrr has mapped that isn't
-- a Flagrr club, which members can still play as an away course. `map` is the
-- whole course map file (see mobile/src/golf/courseMap.ts), validated on
-- import. Members only see status = 'live' maps, and a map can only go live
-- once its card has no publish blockers (checked by the API, not here).
create table if not exists golf_courses (
  id uuid primary key default gen_random_uuid(),
  club_id uuid unique references courses(id) on delete set null,
  name text not null,
  location text not null default '',
  hole_count integer not null check (hole_count in (9, 18)),
  status text not null default 'draft' check (status in ('draft', 'live')),
  map jsonb not null,
  imported_by uuid references admins(id) on delete set null,
  imported_at timestamptz not null default now(),
  published_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists golf_courses_status_idx on golf_courses(status);

-- Photos of a club's scorecard, uploaded by its GM from the admin dashboard
-- so Flagrr can build the club's course map. Stored inline as data URIs, the
-- same as logos and receipt images (no blob storage is configured).
create table if not exists scorecard_photos (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  image_data text not null,
  uploaded_by uuid references admins(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists scorecard_photos_course_id_idx on scorecard_photos(course_id);

-- A member's golf settings: the Handicap Index they type in (Flagrr never
-- calculates its own), how they like to score, their club distances, and
-- whether they enter putts and fairways on the scorecard.
create table if not exists golf_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  handicap_index numeric(3, 1) check (handicap_index between -10 and 54),
  rating_gender text not null default 'men' check (rating_gender in ('men', 'ladies')),
  format text not null default 'stableford' check (format in ('stableford', 'stroke')),
  allowance numeric(3, 2) not null default 0.95 check (allowance in (0.95, 1.00)),
  bag jsonb,
  track_stats boolean not null default false,
  updated_at timestamptz not null default now()
);

-- A round. Everything that decides the score (holes with par / stroke index /
-- length, ratings, handicaps) is copied in when the round starts, so a later
-- correction to the course map never changes a round already played.
-- `entries` is one { s, putts?, fw? } per hole (see mobile/src/golf/scoring.ts);
-- the total_* columns are recomputed by the API on every save.
create table if not exists golf_rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  golf_course_id uuid references golf_courses(id) on delete set null,
  course_name text not null,
  tee_id text not null,
  tee_name text not null,
  tee_color text not null,
  rating_gender text not null check (rating_gender in ('men', 'ladies')),
  layout text not null check (layout in ('full', 'front9', 'back9')),
  format text not null check (format in ('stableford', 'stroke')),
  allowance numeric(3, 2) not null,
  handicap_index numeric(3, 1),
  course_rating numeric(4, 1) not null,
  slope integer not null,
  par integer not null,
  course_handicap integer,
  playing_handicap integer,
  holes jsonb not null,
  entries jsonb not null,
  track_stats boolean not null default false,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  total_points integer not null default 0,
  total_gross integer,
  total_adjusted integer not null default 0,
  holes_played integer not null default 0,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists golf_rounds_user_status_idx on golf_rounds(user_id, status, completed_at);
-- One round in progress per member at a time.
create unique index if not exists golf_rounds_one_in_progress_idx on golf_rounds(user_id) where status = 'in_progress';
