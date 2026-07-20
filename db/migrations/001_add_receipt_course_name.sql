-- Run this against the already-provisioned database (schema.sql has been
-- updated to include this column for anyone applying it fresh).
alter table receipts add column if not exists course_name text not null default '';
