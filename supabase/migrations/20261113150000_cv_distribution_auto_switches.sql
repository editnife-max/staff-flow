-- Managers can turn off the automatic CV jobs for their company.
-- Stored in profiles.cv_page_requirements (missing = on):
--   auto_distribute  = "false" → skip the nightly distribution
--   auto_expiry_move = "false" → skip the hourly "office did not respond" move
-- Manual runs, manual sends and locked-office moves are not affected.

CREATE OR REPLACE FUNCTION public.enqueue_cv_jobs(p_kind text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count  int;
  v_days   int := public.cv_expiry_days();
  v_switch text;
BEGIN
  IF p_kind NOT IN ('distribute', 'expiry') THEN
    RAISE EXCEPTION 'enqueue_cv_jobs: unsupported kind %', p_kind;
  END IF;
  v_switch := CASE p_kind WHEN 'distribute' THEN 'auto_distribute' ELSE 'auto_expiry_move' END;

  INSERT INTO public.distribution_jobs (manager_id, kind, trigger)
  SELECT m.manager_id, p_kind, 'scheduled'
    FROM (SELECT DISTINCT manager_id FROM public.assignment_offices) m
   WHERE COALESCE((SELECT p.cv_page_requirements ->> v_switch
                     FROM public.profiles p WHERE p.id = m.manager_id), 'true') <> 'false'
     AND NOT EXISTS (
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

REVOKE ALL ON FUNCTION public.enqueue_cv_jobs(text) FROM PUBLIC, anon, authenticated;
