-- Allow first_login_at to be NULL (tentative-late / absent rows have no login time)
ALTER TABLE public.staff_daily_attendance
  ALTER COLUMN first_login_at DROP NOT NULL;

-- Track no-login days separately from late-login days
ALTER TABLE public.staff_daily_attendance
  ADD COLUMN IF NOT EXISTS absent BOOLEAN NOT NULL DEFAULT false;

-- Allow staff to submit a reason for being late
ALTER TABLE public.staff_daily_attendance
  ADD COLUMN IF NOT EXISTS reason TEXT;

-- Allow managers to excuse a late/absent day
ALTER TABLE public.staff_daily_attendance
  ADD COLUMN IF NOT EXISTS excused BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.staff_daily_attendance
  ADD COLUMN IF NOT EXISTS excused_at TIMESTAMPTZ;
