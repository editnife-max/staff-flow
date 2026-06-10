ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS coc_agency_name TEXT,
  ADD COLUMN IF NOT EXISTS coc_agency_phone TEXT;
