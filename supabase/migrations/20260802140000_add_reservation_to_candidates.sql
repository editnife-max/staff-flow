alter table candidates
  add column if not exists reserved_at  timestamptz,
  add column if not exists reserved_by  text;
