-- Allow first_login_at to be NULL for absent (no-login) days
ALTER TABLE public.staff_daily_attendance
  ALTER COLUMN first_login_at DROP NOT NULL;

-- Track whether the row was inserted as an absent/no-show day
ALTER TABLE public.staff_daily_attendance
  ADD COLUMN IF NOT EXISTS absent BOOLEAN NOT NULL DEFAULT false;
