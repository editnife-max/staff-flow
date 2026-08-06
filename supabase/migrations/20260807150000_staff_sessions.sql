CREATE TABLE IF NOT EXISTS public.staff_sessions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manager_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  staff_id          UUID        REFERENCES public.staff(id) ON DELETE SET NULL,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at          TIMESTAMPTZ,
  device_type       TEXT        NOT NULL DEFAULT 'desktop',
  user_agent        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_can_select_own_sessions"
  ON public.staff_sessions FOR SELECT
  TO authenticated
  USING (staff_user_id = auth.uid());

CREATE POLICY "manager_can_select_team_sessions"
  ON public.staff_sessions FOR SELECT
  TO authenticated
  USING (manager_id = auth.uid());

CREATE INDEX IF NOT EXISTS staff_sessions_staff_user_id_idx
  ON public.staff_sessions (staff_user_id);

CREATE INDEX IF NOT EXISTS staff_sessions_manager_id_idx
  ON public.staff_sessions (manager_id);

CREATE INDEX IF NOT EXISTS staff_sessions_manager_started_idx
  ON public.staff_sessions (manager_id, started_at DESC);
