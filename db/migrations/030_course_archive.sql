alter table courses add column archived_at timestamptz;

create index courses_archived_at_idx on courses(archived_at);
