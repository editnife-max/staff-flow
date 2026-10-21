ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS lmis_enjaz_url     TEXT,
  ADD COLUMN IF NOT EXISTS lmis_contract_url  TEXT,
  ADD COLUMN IF NOT EXISTS lmis_passport_url  TEXT;
