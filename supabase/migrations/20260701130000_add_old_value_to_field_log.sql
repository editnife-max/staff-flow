ALTER TABLE candidate_field_log ADD COLUMN IF NOT EXISTS old_value TEXT;
ALTER TABLE candidate_field_log ADD COLUMN IF NOT EXISTS changed_by_email TEXT;
