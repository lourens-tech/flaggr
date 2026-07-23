create table admin_broadcasts (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  admin_id uuid references admins(id) on delete set null,
  title text not null,
  body text not null,
  target text not null, -- 'all' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum'
  recipient_count integer not null default 0,
  sent_at timestamptz not null default now()
);

create index if not exists admin_broadcasts_course_id_idx on admin_broadcasts(course_id);
