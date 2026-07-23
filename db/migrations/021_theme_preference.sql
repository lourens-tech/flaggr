-- Dark mode preference, synced per-account so it follows a user to any
-- device. 'system' (the default) means "follow the OS setting"; 'light'/
-- 'dark' are explicit manual overrides. One column shape on both tables —
-- members (`users`) and admins/staff (`admins`) each get their own.

alter table users add column if not exists theme_preference text not null default 'system'
  check (theme_preference in ('system', 'light', 'dark'));

alter table admins add column if not exists theme_preference text not null default 'system'
  check (theme_preference in ('system', 'light', 'dark'));
