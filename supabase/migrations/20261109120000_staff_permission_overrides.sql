-- Per-staff column editing and page access overrides
CREATE TABLE IF NOT EXISTS public.staff_permission_overrides (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id     UUID        NOT NULL REFERENCES auth.users(id)  ON DELETE CASCADE,
  staff_user_id  UUID        NOT NULL REFERENCES auth.users(id)  ON DELETE CASCADE,
  type           TEXT        NOT NULL CHECK (type IN ('column_edit', 'page_access')),
  target         TEXT        NOT NULL,
  mode           TEXT        NOT NULL CHECK (mode IN ('grant', 'deny')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (manager_id, staff_user_id, type, target)
);

ALTER TABLE public.staff_permission_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manager_owns_overrides"
  ON public.staff_permission_overrides
  FOR ALL TO authenticated
  USING  (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());

CREATE POLICY "staff_can_read_own_overrides"
  ON public.staff_permission_overrides
  FOR SELECT TO authenticated
  USING (staff_user_id = auth.uid());

CREATE INDEX IF NOT EXISTS spo_manager_staff_idx
  ON public.staff_permission_overrides (manager_id, staff_user_id);
