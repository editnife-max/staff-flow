-- Track when a suspension was lifted so future incident counting starts fresh from that date.
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS penalty_window_start DATE;
