CREATE TABLE IF NOT EXISTS public.staff_activity_pings (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manager_id     UUID        NOT NULL,
  session_id     UUID        REFERENCES public.staff_sessions(id) ON DELETE SET NULL,
  pinged_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_pings_user_time
  ON public.staff_activity_pings (staff_user_id, pinged_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_pings_manager_time
  ON public.staff_activity_pings (manager_id, pinged_at DESC);

ALTER TABLE public.staff_activity_pings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_can_insert_own_pings"
  ON public.staff_activity_pings FOR INSERT
  TO authenticated
  WITH CHECK (staff_user_id = auth.uid());

CREATE POLICY "staff_can_read_own_pings"
  ON public.staff_activity_pings FOR SELECT
  TO authenticated
  USING (staff_user_id = auth.uid());

CREATE POLICY "manager_can_read_team_pings"
  ON public.staff_activity_pings FOR SELECT
  TO authenticated
  USING (manager_id = auth.uid());
