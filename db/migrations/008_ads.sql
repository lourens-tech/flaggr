-- Ad space content — lets a future super-admin panel manage the ad
-- creative shown in the "Ad Space" slots on Home and the Rewards Shop
-- without an app release. Scoped per course, like rewards.
create table if not exists ads (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  placement text not null check (placement in ('home', 'rewards_shop')),
  title text not null default '',
  image_url text,
  target_url text,
  sort_order integer not null default 0,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ads_course_id_placement_idx on ads(course_id, placement);
