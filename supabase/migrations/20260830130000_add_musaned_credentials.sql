alter table profiles
  add column if not exists musaned_email    text,
  add column if not exists musaned_password text;
