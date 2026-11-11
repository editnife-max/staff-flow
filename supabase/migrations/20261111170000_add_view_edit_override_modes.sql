-- Extend the mode CHECK constraint to include 'view' and 'edit' modes
ALTER TABLE public.staff_permission_overrides
  DROP CONSTRAINT IF EXISTS staff_permission_overrides_mode_check;

ALTER TABLE public.staff_permission_overrides
  ADD CONSTRAINT staff_permission_overrides_mode_check
  CHECK (mode IN ('grant', 'deny', 'view', 'edit'));
