-- Add a stored generated tsvector column that combines all meaningful text fields.
-- A single GIN index on this column enables fast full-text search across 16 fields
-- without maintaining separate trigram indexes for each new field.
-- Uses the 'simple' dictionary so names, codes, and multi-language text are matched
-- exactly (no stemming, no stop-word removal).

ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(full_name,           '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(candidate_code,      '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(passport_number,     '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(labour_id,           '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(serial_number,       '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(occupation,          '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(country,             '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(destination_country, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(office,              '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(notes,               '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(narrative,           '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(skills,              '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(living_town,         '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(selected_by,         '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(cv_sent_to,          '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(coc_agency_name,     '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_candidates_search_vector
  ON public.candidates USING gin(search_vector);
