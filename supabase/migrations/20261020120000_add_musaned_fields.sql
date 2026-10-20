-- Add Musaned employer/visa fields to candidates
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS musaned_visa_number   TEXT,
  ADD COLUMN IF NOT EXISTS musaned_employer_city TEXT,
  ADD COLUMN IF NOT EXISTS musaned_employer_name TEXT,
  ADD COLUMN IF NOT EXISTS musaned_employer_phone TEXT,
  ADD COLUMN IF NOT EXISTS musaned_house_number  TEXT,
  ADD COLUMN IF NOT EXISTS musaned_fetched_at    TIMESTAMPTZ;
