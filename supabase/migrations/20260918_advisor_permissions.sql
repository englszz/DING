-- Follow-up to the exported Security Advisor report. Safe to rerun.
BEGIN;
-- Public image URLs remain public; only the owner needs SELECT for avatar upserts.
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own avatar objects" ON storage.objects;
CREATE POLICY "Users can read own avatar objects" ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='avatars' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
-- Trigger invocation still works: clients do not need direct EXECUTE permission.
REVOKE ALL ON FUNCTION public.ding_remove_rated_saved() FROM PUBLIC,anon,authenticated;
-- Supabase may grant anon explicitly; revoking PUBLIC alone does not remove it.
REVOKE ALL ON FUNCTION public.ding_save_album(text,text,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ding_save_album(text,text,text,text,text,text) TO authenticated;
COMMIT;

SELECT
 has_function_privilege('anon','public.ding_save_album(text,text,text,text,text,text)','EXECUTE') AS anon_can_save,
 has_function_privilege('authenticated','public.ding_save_album(text,text,text,text,text,text)','EXECUTE') AS users_can_save,
 has_function_privilege('anon','public.ding_remove_rated_saved()','EXECUTE') AS anon_can_call_trigger,
 has_function_privilege('authenticated','public.ding_remove_rated_saved()','EXECUTE') AS users_can_call_trigger;
-- Expected: false, true, false, false.
