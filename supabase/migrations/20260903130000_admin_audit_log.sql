-- Generic audit log for admin/manager actions (password resets, deletions, etc.)
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  action      text NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata    jsonb
);

-- Only service_role can insert; no SELECT via RLS (admins use service_role client)
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.admin_audit_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Index for querying by actor or target
CREATE INDEX IF NOT EXISTS idx_audit_actor  ON public.admin_audit_log (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_target ON public.admin_audit_log (target_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.admin_audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_time   ON public.admin_audit_log (created_at DESC);
