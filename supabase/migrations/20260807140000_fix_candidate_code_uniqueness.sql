-- Step 1: Assign codes to every candidate that currently has NULL candidate_code.
-- next_candidate_code() is atomic (uses a locked sequence row), so parallel calls are safe.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, manager_id
    FROM public.candidates
    WHERE candidate_code IS NULL
    ORDER BY manager_id, created_at
  LOOP
    UPDATE public.candidates
    SET candidate_code = public.next_candidate_code(r.manager_id)
    WHERE id = r.id;
  END LOOP;
END $$;

-- Step 2: Resolve any remaining true duplicates (same code, same manager).
-- Keep the oldest row's code; reassign every later duplicate.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.id, c.manager_id
    FROM public.candidates c
    WHERE EXISTS (
      SELECT 1 FROM public.candidates c2
      WHERE c2.manager_id = c.manager_id
        AND c2.candidate_code = c.candidate_code
        AND c2.created_at < c.created_at  -- earlier row keeps the code
    )
    ORDER BY c.manager_id, c.created_at
  LOOP
    UPDATE public.candidates
    SET candidate_code = public.next_candidate_code(r.manager_id)
    WHERE id = r.id;
  END LOOP;
END $$;

-- Step 3: Now that every row has a code, enforce NOT NULL.
ALTER TABLE public.candidates
  ALTER COLUMN candidate_code SET NOT NULL;

-- Step 4: Batch code generator — atomically reserves N consecutive codes in one round-trip.
-- Used by bulkImportCandidates to avoid N separate RPC calls.
CREATE OR REPLACE FUNCTION public.next_candidate_codes_batch(p_manager_id uuid, p_count integer)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start  integer;
  v_codes  text[];
  i        integer;
BEGIN
  INSERT INTO public.candidate_code_sequences (manager_id, last_number)
  VALUES (p_manager_id, p_count)
  ON CONFLICT (manager_id)
  DO UPDATE SET last_number = candidate_code_sequences.last_number + p_count
  RETURNING last_number - p_count INTO v_start;

  v_codes := ARRAY[]::text[];
  FOR i IN 1 .. p_count LOOP
    v_codes := array_append(v_codes, 'C-' || lpad((v_start + i)::text, 4, '0'));
  END LOOP;
  RETURN v_codes;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_candidate_codes_batch(uuid, integer) TO authenticated, service_role;
