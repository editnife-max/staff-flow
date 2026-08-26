-- Allows managers to lock an office so it stops receiving new candidates via distribution
ALTER TABLE public.assignment_offices
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false;
