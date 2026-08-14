ALTER TABLE candidates ADD COLUMN IF NOT EXISTS cv_resent_offices jsonb;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS cv_resent_date text;
