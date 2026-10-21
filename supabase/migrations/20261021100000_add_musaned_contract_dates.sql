ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS musaned_contract_start DATE,
  ADD COLUMN IF NOT EXISTS musaned_contract_end   DATE;
