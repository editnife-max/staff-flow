alter table profiles
  add column if not exists tc_enabled boolean not null default true;
