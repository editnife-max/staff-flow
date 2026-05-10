
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_manager_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_manager_id(uuid) TO authenticated;

DROP POLICY "Anyone view candidate photos" ON storage.objects;
CREATE POLICY "Authenticated view candidate photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'candidate-photos');
