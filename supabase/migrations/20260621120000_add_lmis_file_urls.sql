ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS lmis_insu_url TEXT,
  ADD COLUMN IF NOT EXISTS lmis_coc_url TEXT,
  ADD COLUMN IF NOT EXISTS lmis_id_url TEXT,
  ADD COLUMN IF NOT EXISTS lmis_id_relative_url TEXT;
