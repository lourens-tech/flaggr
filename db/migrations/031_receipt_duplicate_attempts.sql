-- Previously a duplicate receipt (same receipt_number or image_hash as one
-- already redeemed, at any club) was just rejected with no record kept —
-- discarding the single clearest cross-club fraud signal the app has.
create table receipt_duplicate_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  match_type text not null check (match_type in ('receipt_number', 'image_hash')),
  matched_receipt_id uuid references receipts(id) on delete set null,
  attempted_at timestamptz not null default now()
);

create index receipt_duplicate_attempts_user_id_idx on receipt_duplicate_attempts(user_id);
create index receipt_duplicate_attempts_attempted_at_idx on receipt_duplicate_attempts(attempted_at desc);
