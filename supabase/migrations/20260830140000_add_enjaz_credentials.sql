alter table profiles
  add column if not exists enjaz_email    text,
  add column if not exists enjaz_password text;
