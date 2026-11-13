-- CV distribution v2: office star ratings, global expiry setting, background job
-- queue (pg_cron + pg_net → cv-distribution edge function), office-only CV
-- visibility for agency users, and clean-up of bad cv_sent_to data.

-- ── 1. Office star rating ─────────────────────────────────────────────────────
ALTER TABLE public.assignment_offices
  ADD COLUMN IF NOT EXISTS rating smallint NOT NULL DEFAULT 3;
ALTER TABLE public.assignment_offices DROP CONSTRAINT IF EXISTS assignment_offices_rating_check;
ALTER TABLE public.assignment_offices
  ADD CONSTRAINT assignment_offices_rating_check CHECK (rating BETWEEN 1 AND 5);

-- ── 2. Global settings (admin-owned) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.system_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read settings" ON public.system_settings;
CREATE POLICY "Authenticated read settings"
  ON public.system_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins write settings" ON public.system_settings;
CREATE POLICY "Admins write settings"
  ON public.system_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- How many days an office has to respond before its CVs move to another office
INSERT INTO public.system_settings (key, value)
VALUES ('cv_expiry_days', '6'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.cv_expiry_days()
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT (value #>> '{}')::int FROM public.system_settings WHERE key = 'cv_expiry_days'), 6);
$$;

-- ── 3. Distribution job queue ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.distribution_jobs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id  uuid NOT NULL,
  kind        text NOT NULL CHECK (kind IN ('distribute', 'expiry', 'office_locked', 'manual_send')),
  trigger     text NOT NULL DEFAULT 'manual' CHECK (trigger IN ('manual', 'scheduled', 'system')),
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'failed', 'cancelled')),
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  result      jsonb,
  error       text,
  run_at      timestamptz NOT NULL DEFAULT now(),
  started_at  timestamptz,
  finished_at timestamptz,
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_distribution_jobs_queue   ON public.distribution_jobs (status, run_at);
CREATE INDEX IF NOT EXISTS idx_distribution_jobs_manager ON public.distribution_jobs (manager_id, created_at DESC);

ALTER TABLE public.distribution_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Managers view own distribution jobs" ON public.distribution_jobs;
CREATE POLICY "Managers view own distribution jobs"
  ON public.distribution_jobs FOR SELECT TO authenticated
  USING (manager_id = auth.uid() OR manager_id = public.get_manager_id(auth.uid()));
-- Writes go through server functions / the worker (service role) only.

-- Claim the next due job. One running job per manager at a time; stuck jobs fail after 15 min.
CREATE OR REPLACE FUNCTION public.claim_distribution_job()
RETURNS SETOF public.distribution_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('claim_distribution_job'));

  UPDATE public.distribution_jobs
     SET status = 'failed', error = 'Timed out', finished_at = now()
   WHERE status = 'running' AND started_at < now() - interval '15 minutes';

  RETURN QUERY
  UPDATE public.distribution_jobs j
     SET status = 'running', started_at = now()
   WHERE j.id = (
     SELECT p.id FROM public.distribution_jobs p
      WHERE p.status = 'pending' AND p.run_at <= now()
        AND NOT EXISTS (
          SELECT 1 FROM public.distribution_jobs r
           WHERE r.manager_id = p.manager_id AND r.status = 'running')
      ORDER BY p.run_at, p.created_at
      LIMIT 1
      FOR UPDATE SKIP LOCKED)
  RETURNING j.*;
END $$;

-- ── 4. Background worker wiring (pg_cron + pg_net) ────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Calls the cv-distribution edge function. URL + secret live in Supabase Vault:
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/cv-distribution', 'cv_worker_url');
--   select vault.create_secret('<random secret>', 'cv_worker_secret');
CREATE OR REPLACE FUNCTION public.kick_cv_worker()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_url    text;
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_url    FROM vault.decrypted_secrets WHERE name = 'cv_worker_url';
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'cv_worker_secret';
  IF v_url IS NULL OR v_secret IS NULL THEN
    RAISE WARNING 'cv-distribution worker not configured (vault secrets cv_worker_url / cv_worker_secret missing)';
    RETURN;
  END IF;
  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-worker-secret', v_secret),
    body    := '{"action":"process"}'::jsonb,
    timeout_milliseconds := 5000
  );
END $$;

-- Only wakes the worker when something is actually due — keeps invocations near zero.
CREATE OR REPLACE FUNCTION public.kick_cv_worker_if_due()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.distribution_jobs WHERE status = 'pending' AND run_at <= now()) THEN
    PERFORM public.kick_cv_worker();
  END IF;
END $$;

-- New due jobs wake the worker immediately (once per INSERT statement).
CREATE OR REPLACE FUNCTION public.distribution_jobs_kick()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM new_rows WHERE status = 'pending' AND run_at <= now()) THEN
    PERFORM public.kick_cv_worker();
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS distribution_jobs_kick ON public.distribution_jobs;
CREATE TRIGGER distribution_jobs_kick
  AFTER INSERT ON public.distribution_jobs
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.distribution_jobs_kick();

-- Queue one scheduled job per manager that has offices (skips managers that already have one queued).
-- Expiry jobs are only queued for managers that actually have expired CVs.
CREATE OR REPLACE FUNCTION public.enqueue_cv_jobs(p_kind text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count int;
  v_days  int := public.cv_expiry_days();
BEGIN
  IF p_kind NOT IN ('distribute', 'expiry') THEN
    RAISE EXCEPTION 'enqueue_cv_jobs: unsupported kind %', p_kind;
  END IF;

  INSERT INTO public.distribution_jobs (manager_id, kind, trigger)
  SELECT m.manager_id, p_kind, 'scheduled'
    FROM (SELECT DISTINCT manager_id FROM public.assignment_offices) m
   WHERE NOT EXISTS (
           SELECT 1 FROM public.distribution_jobs j
            WHERE j.manager_id = m.manager_id AND j.kind = p_kind AND j.status IN ('pending', 'running'))
     AND (p_kind <> 'expiry' OR EXISTS (
           SELECT 1 FROM public.candidates c
            WHERE c.manager_id = m.manager_id
              AND c.status = 'available'
              AND c.selected_by IS NULL
              AND c.cv_sent_to IS NOT NULL
              AND c.cv_sent_date <= current_date - v_days));
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

REVOKE ALL ON FUNCTION public.claim_distribution_job()   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kick_cv_worker()           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kick_cv_worker_if_due()    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_cv_jobs(text)      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.distribution_jobs_kick()   FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_distribution_job() TO service_role;
GRANT EXECUTE ON FUNCTION public.cv_expiry_days()         TO authenticated, service_role;

-- Schedules (pg_cron runs in UTC). Midnight Addis Ababa (UTC+3) = 21:00 UTC.
SELECT cron.unschedule(jobname) FROM cron.job
 WHERE jobname IN ('cv-nightly-distribution', 'cv-hourly-expiry', 'cv-worker-tick');
SELECT cron.schedule('cv-nightly-distribution', '0 21 * * *', $$SELECT public.enqueue_cv_jobs('distribute')$$);
SELECT cron.schedule('cv-hourly-expiry',        '0 * * * *',  $$SELECT public.enqueue_cv_jobs('expiry')$$);
-- Picks up delayed jobs (office locked "after 1 hour / 1 day") and retries.
SELECT cron.schedule('cv-worker-tick',          '*/5 * * * *', $$SELECT public.kick_cv_worker_if_due()$$);

-- ── 5. Agency users only see CVs sent to their own office ─────────────────────
CREATE OR REPLACE FUNCTION public.current_agency_name()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.agency_name FROM public.profiles p
   WHERE p.id = auth.uid() AND public.has_role(auth.uid(), 'agency');
$$;
GRANT EXECUTE ON FUNCTION public.current_agency_name() TO authenticated;

DROP POLICY IF EXISTS "Agency view own sent CVs" ON public.candidates;
CREATE POLICY "Agency view own sent CVs"
  ON public.candidates FOR SELECT TO authenticated
  USING (cv_sent_to IS NOT NULL AND cv_sent_to = (SELECT public.current_agency_name()));

-- RESTRICTIVE: whatever other policies exist, an agency user can never reach a
-- candidate that is not currently sent to their office.
DROP POLICY IF EXISTS "Agency limited to own CVs" ON public.candidates;
CREATE POLICY "Agency limited to own CVs"
  ON public.candidates AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    (SELECT NOT public.has_role(auth.uid(), 'agency'))
    OR (cv_sent_to IS NOT NULL AND cv_sent_to = (SELECT public.current_agency_name()))
  );

-- ── 6. Data clean-up ──────────────────────────────────────────────────────────
-- Trainees must never hold an office
UPDATE public.candidates
   SET cv_sent_to = NULL, cv_sent_date = NULL
 WHERE cv_sent_to IS NOT NULL
   AND status = 'available'
   AND availability_type IN ('TC', 'TC_failed');

-- Old bug: setting a candidate's Country copied the country name into cv_sent_to
UPDATE public.candidates c
   SET cv_sent_to = NULL, cv_sent_date = NULL
 WHERE c.cv_sent_to IS NOT NULL
   AND EXISTS (SELECT 1 FROM public.assignment_countries ac
                WHERE ac.manager_id = c.manager_id AND ac.name = c.cv_sent_to)
   AND NOT EXISTS (SELECT 1 FROM public.assignment_offices ao
                    WHERE ao.manager_id = c.manager_id AND ao.name = c.cv_sent_to);

CREATE INDEX IF NOT EXISTS idx_candidates_manager_status_sent
  ON public.candidates (manager_id, status, cv_sent_to);
