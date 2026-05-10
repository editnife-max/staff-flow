
-- Enums
DO $$ BEGIN CREATE TYPE public.medical_status AS ENUM ('pending','fit','unfit'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.passport_status AS ENUM ('pending','submitted','received','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.doc_status AS ENUM ('pending','in_progress','done','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.office_name AS ENUM ('saudi','kuwait','uae','qatar','bahrain','oman','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Columns
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS candidate_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS birth_place text,
  ADD COLUMN IF NOT EXISTS living_town text,
  ADD COLUMN IF NOT EXISTS labour_id text,
  ADD COLUMN IF NOT EXISTS office public.office_name,
  ADD COLUMN IF NOT EXISTS passport_status public.passport_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS coc_status public.doc_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS musaned_status public.doc_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS medical_status public.medical_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS medical_date date,
  ADD COLUMN IF NOT EXISTS selected_by text,
  ADD COLUMN IF NOT EXISTS cv_sent_to text,
  ADD COLUMN IF NOT EXISTS cv_sent_date date,
  ADD COLUMN IF NOT EXISTS narrative text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Auto code generator
CREATE OR REPLACE FUNCTION public.set_candidate_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE new_code text;
BEGIN
  IF NEW.candidate_code IS NULL OR length(trim(NEW.candidate_code)) = 0 THEN
    LOOP
      new_code := 'CND-' || lpad(((floor(random() * 900000) + 100000))::int::text, 6, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.candidates WHERE candidate_code = new_code);
    END LOOP;
    NEW.candidate_code := new_code;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_candidates_set_code ON public.candidates;
CREATE TRIGGER trg_candidates_set_code
  BEFORE INSERT ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.set_candidate_code();

-- Backfill missing codes
UPDATE public.candidates SET candidate_code = 'CND-' || lpad(((floor(random()*900000)+100000))::int::text,6,'0')
  WHERE candidate_code IS NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_candidates_manager_deleted ON public.candidates (manager_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_candidates_manager_status ON public.candidates (manager_id, status);
CREATE INDEX IF NOT EXISTS idx_candidates_manager_medical ON public.candidates (manager_id, medical_status);
CREATE INDEX IF NOT EXISTS idx_candidates_manager_office ON public.candidates (manager_id, office);

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_candidates_full_name_trgm ON public.candidates USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_candidates_code_trgm ON public.candidates USING gin (candidate_code gin_trgm_ops);
