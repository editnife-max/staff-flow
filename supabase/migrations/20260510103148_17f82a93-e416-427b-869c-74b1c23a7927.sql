ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS assigned_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_candidates_assigned_staff_id
  ON public.candidates(assigned_staff_id);