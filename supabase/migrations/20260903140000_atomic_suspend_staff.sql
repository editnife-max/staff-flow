-- Atomically counts unexcused incidents and suspends the staff member if
-- the threshold is reached. Uses SELECT FOR UPDATE on the staff row so
-- concurrent logins cannot both read the same count and both trigger (or
-- both skip) a suspension.
CREATE OR REPLACE FUNCTION public.check_and_maybe_suspend_staff(
  p_user_id      UUID,
  p_now          TIMESTAMPTZ,
  p_max_incidents INT,
  p_lookback_days INT
)
RETURNS TABLE (incident_count INT, was_suspended BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_staff_id        UUID;
  v_suspended_at    TIMESTAMPTZ;
  v_window_start    DATE;
  v_cutoff          DATE;
  v_effective_cutoff DATE;
  v_count           INT;
BEGIN
  -- Lock the staff row for the duration of this transaction
  SELECT id, suspended_at
  INTO   v_staff_id, v_suspended_at
  FROM   public.staff
  WHERE  user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::INT, false::BOOLEAN;
    RETURN;
  END IF;

  v_cutoff       := (p_now - (p_lookback_days::TEXT || ' days')::INTERVAL)::DATE;
  v_window_start := CASE WHEN v_suspended_at IS NOT NULL THEN v_suspended_at::DATE ELSE NULL END;
  v_effective_cutoff := CASE
    WHEN v_window_start IS NOT NULL AND v_window_start > v_cutoff THEN v_window_start
    ELSE v_cutoff
  END;

  SELECT COUNT(*)::INT INTO v_count
  FROM   public.staff_daily_attendance
  WHERE  staff_user_id = p_user_id
    AND  excused       = false
    AND  (is_late = true OR absent = true)
    AND  date >= v_effective_cutoff;

  IF v_count >= p_max_incidents THEN
    UPDATE public.staff
    SET    is_suspended = true,
           suspended_at = p_now
    WHERE  id = v_staff_id;

    RETURN QUERY SELECT v_count, true::BOOLEAN;
  ELSE
    RETURN QUERY SELECT v_count, false::BOOLEAN;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.check_and_maybe_suspend_staff(UUID, TIMESTAMPTZ, INT, INT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.check_and_maybe_suspend_staff(UUID, TIMESTAMPTZ, INT, INT) TO service_role;
