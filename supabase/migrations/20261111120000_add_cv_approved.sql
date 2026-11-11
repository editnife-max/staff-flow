ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS cv_approved boolean NOT NULL DEFAULT false;
