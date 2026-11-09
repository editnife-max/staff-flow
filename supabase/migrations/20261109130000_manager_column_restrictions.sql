-- Global column restrictions stored per manager on their profile
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS restricted_columns JSONB NOT NULL DEFAULT '{}';
