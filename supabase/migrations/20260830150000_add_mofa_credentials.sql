alter table profiles
  add column if not exists mofa_email    text,
  add column if not exists mofa_password text;
