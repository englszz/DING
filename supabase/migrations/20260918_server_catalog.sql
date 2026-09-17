-- Deploy matching server code and configure SUPABASE_SERVICE_ROLE_KEY first.
-- Never use a NEXT_PUBLIC_ prefix for that key. Apply after privacy migration.
BEGIN;
CREATE TABLE IF NOT EXISTS ding_private.import_windows(user_id uuid PRIMARY KEY,window_start timestamptz NOT NULL,hits integer NOT NULL);
REVOKE INSERT,UPDATE,DELETE ON public.albums,public.tracks,public.album_groups,public.album_external_refs FROM anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.ding_import_itunes(text,jsonb),public.ding_finish_import(text,uuid,uuid,uuid,jsonb),public.ding_claim_import(text),public.ding_release_import(text,uuid),public.ding_set_itunes_artwork(text,text) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.ding_catalog_write(p_user_id uuid,p_operation text,p_args jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE n integer; result jsonb; previous_sub text:=current_setting('request.jwt.claim.sub',true);
BEGIN
 IF p_user_id IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id) THEN RAISE EXCEPTION 'Invalid user'; END IF;
 IF p_operation IN ('ding_claim_import','ding_import_itunes','ding_set_itunes_artwork') THEN
 INSERT INTO ding_private.import_windows VALUES(p_user_id,date_trunc('minute',now()),1)
 ON CONFLICT(user_id) DO UPDATE SET window_start=EXCLUDED.window_start,hits=CASE WHEN import_windows.window_start=EXCLUDED.window_start THEN import_windows.hits+1 ELSE 1 END RETURNING hits INTO n;
 IF n>40 THEN RAISE EXCEPTION 'Too many imports; retry in one minute'; END IF;
 END IF;
 -- Only the verified server can execute this wrapper. Existing RPCs use auth.uid().
 PERFORM set_config('request.jwt.claim.sub',p_user_id::text,true);
 CASE p_operation
 WHEN 'ding_import_itunes' THEN result:=to_jsonb(public.ding_import_itunes(p_args->>'p_external_id',p_args->'p_details'));
 WHEN 'ding_claim_import' THEN result:=to_jsonb(public.ding_claim_import(p_args->>'p_key'));
 WHEN 'ding_release_import' THEN PERFORM public.ding_release_import(p_args->>'p_key',(p_args->>'p_token')::uuid);
 WHEN 'ding_finish_import' THEN result:=to_jsonb(public.ding_finish_import(p_args->>'p_key',(p_args->>'p_token')::uuid,(p_args->>'p_release_id')::uuid,(p_args->>'p_group_id')::uuid,nullif(p_args->'p_details','null'::jsonb)));
 WHEN 'ding_set_itunes_artwork' THEN PERFORM public.ding_set_itunes_artwork(p_args->>'p_id',p_args->>'p_url');
 ELSE RAISE EXCEPTION 'Unsupported catalog operation'; END CASE;
 PERFORM set_config('request.jwt.claim.sub',coalesce(previous_sub,''),true);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.ding_catalog_write(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ding_catalog_write(uuid,text,jsonb) TO service_role;
COMMIT;
