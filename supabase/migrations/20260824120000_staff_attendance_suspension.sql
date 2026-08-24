-- Add suspension fields to the staff table
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

-- Daily attendance — one row per (staff_user_id, calendar day in EAT/UTC+3)
CREATE TABLE IF NOT EXISTS public.staff_daily_attendance (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id   UUID        NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  manager_id      UUID        NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  staff_id        UUID                    REFERENCES public.staff(id) ON DELETE SET NULL,
  date            DATE        NOT NULL,
  first_login_at  TIMESTAMPTZ NOT NULL,
  is_late         BOOLEAN     NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (staff_user_id, date)
);

ALTER TABLE public.staff_daily_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_can_view_own_attendance"
  ON public.staff_daily_attendance FOR SELECT TO authenticated
  USING (staff_user_id = auth.uid());

CREATE POLICY "manager_can_view_team_attendance"
  ON public.staff_daily_attendance FOR SELECT TO authenticated
  USING (manager_id = auth.uid());

CREATE INDEX IF NOT EXISTS staff_daily_attendance_staff_date_idx
  ON public.staff_daily_attendance (staff_user_id, date DESC);

CREATE INDEX IF NOT EXISTS staff_daily_attendance_manager_date_idx
  ON public.staff_daily_attendance (manager_id, date DESC);
