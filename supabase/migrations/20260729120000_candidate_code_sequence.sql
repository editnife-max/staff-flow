-- Seed candidate_code_sequences from existing max codes per manager
INSERT INTO candidate_code_sequences (manager_id, last_number)
SELECT
  manager_id,
  MAX(
    COALESCE(
      (regexp_match(candidate_code, '(\d+)$'))[1]::integer,
      0
    )
  )
FROM candidates
WHERE candidate_code IS NOT NULL
  AND candidate_code ~ '\d+$'
GROUP BY manager_id
ON CONFLICT (manager_id) DO UPDATE
  SET last_number = GREATEST(
    candidate_code_sequences.last_number,
    EXCLUDED.last_number
  );

-- Atomic auto-increment function: always returns a strictly increasing code per manager
CREATE OR REPLACE FUNCTION next_candidate_code(p_manager_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_next integer;
BEGIN
  INSERT INTO candidate_code_sequences (manager_id, last_number)
  VALUES (p_manager_id, 1)
  ON CONFLICT (manager_id)
  DO UPDATE SET last_number = candidate_code_sequences.last_number + 1
  RETURNING last_number INTO v_next;

  RETURN 'C-' || lpad(v_next::text, 4, '0');
END;
$$;

-- Unique constraint: no two candidates of the same manager can share a code
ALTER TABLE candidates
  DROP CONSTRAINT IF EXISTS candidates_manager_candidate_code_unique;

ALTER TABLE candidates
  ADD CONSTRAINT candidates_manager_candidate_code_unique
  UNIQUE (manager_id, candidate_code);
