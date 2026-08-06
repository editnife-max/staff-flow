-- Enable trigram extension for fast ILIKE substring search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Core candidates query indexes (manager scoped queries are the hottest path)
CREATE INDEX IF NOT EXISTS idx_candidates_manager_id
  ON public.candidates(manager_id);

CREATE INDEX IF NOT EXISTS idx_candidates_status
  ON public.candidates(status);

-- Composite: covers the main list fetch (WHERE manager_id = ? ORDER BY created_at)
CREATE INDEX IF NOT EXISTS idx_candidates_manager_created_at
  ON public.candidates(manager_id, created_at DESC);

-- Composite: covers tab-filtered fetch (WHERE manager_id = ? AND status = ?)
CREATE INDEX IF NOT EXISTS idx_candidates_manager_status
  ON public.candidates(manager_id, status);

-- Trigram indexes: make ILIKE '%term%' fast on searchable text columns
CREATE INDEX IF NOT EXISTS idx_candidates_full_name_trgm
  ON public.candidates USING gin(full_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_candidates_passport_number_trgm
  ON public.candidates USING gin(passport_number gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_candidates_candidate_code_trgm
  ON public.candidates USING gin(candidate_code gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_candidates_labour_id_trgm
  ON public.candidates USING gin(labour_id gin_trgm_ops);

-- resolveChangedBy: staff lookup by user_id is called on every field edit
CREATE INDEX IF NOT EXISTS idx_staff_user_id
  ON public.staff(user_id);

-- Field log queries (fetched per-candidate in staff view)
CREATE INDEX IF NOT EXISTS idx_candidate_field_log_candidate_id
  ON public.candidate_field_log(candidate_id);

-- user_roles lookups hit on every authenticated server function call
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id
  ON public.user_roles(user_id);
