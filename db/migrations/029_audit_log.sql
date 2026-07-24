create table audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references admins(id) on delete set null,
  admin_name text not null,
  admin_role text not null,
  action text not null,
  target_type text,
  target_id text,
  target_label text,
  created_at timestamptz not null default now()
);

create index audit_log_created_at_idx on audit_log(created_at desc);
create index audit_log_admin_id_idx on audit_log(admin_id);
