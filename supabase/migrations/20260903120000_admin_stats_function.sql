-- Single-query admin stats replacing 5 parallel count queries
-- Returns all counts in one round-trip.
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT json_build_object(
    'managers',      (SELECT COUNT(*) FROM public.user_roles WHERE role = 'manager'),
    'staff',         (SELECT COUNT(*) FROM public.user_roles WHERE role = 'staff'),
    'agencies',      (SELECT COUNT(*) FROM public.user_roles WHERE role = 'agency'),
    'pending_subs',  (SELECT COUNT(*) FROM public.subscription_requests WHERE status = 'pending'),
    'approved_plans',(SELECT COUNT(*) FROM public.subscription_requests WHERE status = 'approved')
  );
$$;

-- Only admins may call this function
REVOKE ALL ON FUNCTION public.get_admin_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO service_role;
