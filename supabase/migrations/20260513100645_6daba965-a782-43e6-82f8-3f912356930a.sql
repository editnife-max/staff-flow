ALTER TABLE public.candidates
ADD COLUMN IF NOT EXISTS created_by_user_id uuid,
ADD COLUMN IF NOT EXISTS created_by_name text;
CREATE INDEX IF NOT EXISTS idx_candidates_created_by_user_id ON public.candidates(created_by_user_id);