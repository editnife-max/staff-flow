
-- Convert status fields to text for flexible inline editing
ALTER TABLE public.candidates ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.candidates ALTER COLUMN status TYPE text USING (
  CASE status::text
    WHEN 'available' THEN 'available'
    WHEN 'processing' THEN 'selected'
    WHEN 'arrived' THEN 'selected'
    WHEN 'canceled' THEN 'unavailable'
    ELSE 'available'
  END
);
ALTER TABLE public.candidates ALTER COLUMN status SET DEFAULT 'available';

ALTER TABLE public.candidates ALTER COLUMN medical_status DROP DEFAULT;
ALTER TABLE public.candidates ALTER COLUMN medical_status TYPE text USING medical_status::text;
ALTER TABLE public.candidates ALTER COLUMN medical_status SET DEFAULT 'pending';

ALTER TABLE public.candidates ALTER COLUMN passport_status DROP DEFAULT;
ALTER TABLE public.candidates ALTER COLUMN passport_status TYPE text USING passport_status::text;
ALTER TABLE public.candidates ALTER COLUMN passport_status SET DEFAULT 'pending';

ALTER TABLE public.candidates ALTER COLUMN coc_status DROP DEFAULT;
ALTER TABLE public.candidates ALTER COLUMN coc_status TYPE text USING coc_status::text;
ALTER TABLE public.candidates ALTER COLUMN coc_status SET DEFAULT 'pending';

ALTER TABLE public.candidates ALTER COLUMN musaned_status DROP DEFAULT;
ALTER TABLE public.candidates ALTER COLUMN musaned_status TYPE text USING musaned_status::text;
ALTER TABLE public.candidates ALTER COLUMN musaned_status SET DEFAULT 'pending';

ALTER TABLE public.candidates ALTER COLUMN office TYPE text USING office::text;

-- Drop enums no longer in use
DROP TYPE IF EXISTS public.candidate_status;
DROP TYPE IF EXISTS public.medical_status;
DROP TYPE IF EXISTS public.passport_status;
DROP TYPE IF EXISTS public.doc_status;
DROP TYPE IF EXISTS public.office_name;
