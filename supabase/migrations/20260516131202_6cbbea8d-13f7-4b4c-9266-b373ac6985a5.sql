
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS narrative_phone text,
  ADD COLUMN IF NOT EXISTS contract_date date,
  ADD COLUMN IF NOT EXISTS emergency_contact text,
  ADD COLUMN IF NOT EXISTS medical_days integer,
  ADD COLUMN IF NOT EXISTS tasheer_status text,
  ADD COLUMN IF NOT EXISTS tasheer_date date,
  ADD COLUMN IF NOT EXISTS wokala_status text,
  ADD COLUMN IF NOT EXISTS embassy_date date,
  ADD COLUMN IF NOT EXISTS visa_status text,
  ADD COLUMN IF NOT EXISTS insurance_status text,
  ADD COLUMN IF NOT EXISTS unfilled_lmis text,
  ADD COLUMN IF NOT EXISTS lmis_status text,
  ADD COLUMN IF NOT EXISTS ticket_status text,
  ADD COLUMN IF NOT EXISTS ticket_date date,
  ADD COLUMN IF NOT EXISTS arrival_city text,
  ADD COLUMN IF NOT EXISTS processing_notes text;
