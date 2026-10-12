ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS deduction_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deduction_reason text;
