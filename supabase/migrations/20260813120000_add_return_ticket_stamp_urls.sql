ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS return_ticket_url TEXT,
  ADD COLUMN IF NOT EXISTS stamp_url TEXT;
