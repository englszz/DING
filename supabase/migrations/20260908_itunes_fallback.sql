-- Apply AFTER 20260908_library_and_stability.sql. Safe to rerun.
BEGIN;
ALTER TABLE public.saved_albums ALTER COLUMN external_id TYPE text USING external_id::text;
ALTER TABLE public.saved_albums DROP CONSTRAINT IF EXISTS saved_albums_entity_type_check;
ALTER TABLE public.saved_albums ADD CONSTRAINT saved_albums_entity_type_check CHECK(entity_type IN ('release','release-group','itunes'));
CREATE TABLE IF NOT EXISTS public.album_external_refs (
 entity_type text NOT NULL CHECK(entity_type IN ('release','release-group','itunes')),
 external_id text NOT NULL, album_id uuid NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
 PRIMARY KEY(entity_type,external_id)
);
CREATE INDEX IF NOT EXISTS album_external_refs_album_idx ON public.album_external_refs(album_id);
ALTER TABLE public.album_external_refs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public catalog references" ON public.album_external_refs;
CREATE POLICY "Public catalog references" ON public.album_external_refs FOR SELECT USING(true);
GRANT SELECT ON public.album_external_refs TO anon,authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.album_external_refs FROM anon,authenticated;
INSERT INTO public.album_external_refs(entity_type,external_id,album_id)
 SELECT CASE WHEN external_id LIKE 'itunes:%' THEN 'itunes' ELSE 'release' END,
 CASE WHEN external_id LIKE 'itunes:%' THEN substr(external_id,8) ELSE external_id END,id FROM public.albums ON CONFLICT DO NOTHING;
INSERT INTO public.album_external_refs SELECT 'release-group',release_group_id::text,album_id FROM public.album_groups ON CONFLICT DO NOTHING;

DROP FUNCTION IF EXISTS public.ding_save_album(uuid,text,text,text,text,text);
CREATE OR REPLACE FUNCTION public.ding_save_album(p_external_id text,p_entity_type text,p_title text,p_artist text,p_cover_url text DEFAULT NULL,p_year text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_user uuid:=auth.uid();v_album uuid;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF p_entity_type NOT IN ('release','release-group','itunes') OR p_external_id IS NULL OR
   (p_entity_type='itunes' AND p_external_id !~ '^[0-9]{1,20}$') OR
   (p_entity_type<>'itunes' AND p_external_id !~ '^[0-9a-f-]{36}$') THEN RAISE EXCEPTION 'Invalid reference'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text,0));
 SELECT album_id INTO v_album FROM public.album_external_refs WHERE entity_type=p_entity_type AND external_id=p_external_id;
 IF v_album IS NULL AND p_entity_type='release-group' THEN SELECT album_id INTO v_album FROM public.album_groups WHERE release_group_id::text=p_external_id; END IF;
 IF v_album IS NULL THEN SELECT id INTO v_album FROM public.albums WHERE external_id=CASE WHEN p_entity_type='itunes' THEN 'itunes:'||p_external_id ELSE p_external_id END; END IF;
 IF EXISTS(SELECT 1 FROM public.album_ratings WHERE user_id=v_user AND album_id=v_album) THEN RETURN false; END IF;
 INSERT INTO public.saved_albums(user_id,external_id,entity_type,title,artist,cover_url,year) VALUES(v_user,p_external_id,p_entity_type,p_title,p_artist,p_cover_url,p_year) ON CONFLICT DO NOTHING;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.ding_save_album(text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ding_save_album(text,text,text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.ding_remove_rated_saved() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text,0));
 DELETE FROM public.saved_albums s WHERE s.user_id=NEW.user_id AND (
 EXISTS(SELECT 1 FROM public.album_external_refs r WHERE r.album_id=NEW.album_id AND r.entity_type=s.entity_type AND r.external_id=s.external_id) OR
 (s.entity_type='release' AND s.external_id=(SELECT external_id FROM public.albums WHERE id=NEW.album_id)) OR
 (s.entity_type='release-group' AND s.external_id IN (SELECT release_group_id::text FROM public.album_groups WHERE album_id=NEW.album_id)));
 RETURN NEW;
END $$;

-- Reuse only a unique album with identical title, artist, year and ordered songs.
-- No fuzzy identity matching: deluxe versions and different tracklists stay separate.
CREATE OR REPLACE FUNCTION public.ding_matching_album(p_details jsonb) RETURNS uuid
LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT CASE WHEN count(*)=1 THEN (array_agg(a.id))[1] ELSE NULL END FROM public.albums a
 WHERE lower(btrim(a.title))=lower(btrim(p_details->>'title')) AND lower(btrim(a.artist_name))=lower(btrim(p_details->>'artist'))
 AND a.release_date IS NOT NULL AND left(a.release_date,4)=p_details->>'year'
 AND jsonb_array_length(COALESCE(p_details->'tracks','[]'::jsonb))>0
 AND NOT EXISTS(SELECT 1 FROM public.tracks t JOIN jsonb_array_elements(p_details->'tracks') x ON (x.value->>'position')::integer=t.track_number WHERE t.album_id=a.id AND (t.duration_ms IS NULL OR x.value->>'durationMs' IS NULL OR abs(t.duration_ms-(x.value->>'durationMs')::integer)>1000))
 AND (SELECT jsonb_agg(lower(btrim(t.title)) ORDER BY t.track_number) FROM public.tracks t WHERE t.album_id=a.id)=
 (SELECT jsonb_agg(lower(btrim(x.value->>'title')) ORDER BY (x.value->>'position')::integer) FROM jsonb_array_elements(p_details->'tracks') x)
$$;
REVOKE ALL ON FUNCTION public.ding_matching_album(jsonb) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.ding_import_itunes(p_external_id text,p_details jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_album uuid;v_track jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF p_external_id IS NULL OR p_external_id !~ '^[0-9]{1,20}$' THEN RAISE EXCEPTION 'Invalid iTunes reference'; END IF;
 IF p_details IS NULL OR jsonb_array_length(COALESCE(p_details->'tracks','[]'::jsonb))=0 THEN RAISE EXCEPTION 'Complete album required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('itunes:'||p_external_id,1));
 PERFORM pg_advisory_xact_lock(hashtextextended(lower(btrim(p_details->>'title'))||':'||lower(btrim(p_details->>'artist')),2));
 SELECT album_id INTO v_album FROM public.album_external_refs WHERE entity_type='itunes' AND external_id=p_external_id;
 IF v_album IS NULL THEN SELECT id INTO v_album FROM public.albums WHERE external_id='itunes:'||p_external_id; END IF;
 IF v_album IS NULL THEN v_album:=public.ding_matching_album(p_details); END IF;
 IF v_album IS NULL THEN
  INSERT INTO public.albums(external_id,title,artist_name,release_date) VALUES('itunes:'||p_external_id,p_details->>'title',p_details->>'artist',p_details->>'year') RETURNING id INTO v_album;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.tracks WHERE album_id=v_album) THEN
  FOR v_track IN SELECT value FROM jsonb_array_elements(p_details->'tracks') LOOP
   INSERT INTO public.tracks(album_id,title,track_number,duration_ms) VALUES(v_album,v_track->>'title',(v_track->>'position')::integer,(v_track->>'durationMs')::integer);
  END LOOP;
 END IF;
 INSERT INTO public.album_external_refs VALUES('itunes',p_external_id,v_album) ON CONFLICT DO NOTHING;
 DELETE FROM public.saved_albums s WHERE s.entity_type='itunes' AND s.external_id=p_external_id AND EXISTS(SELECT 1 FROM public.album_ratings r WHERE r.album_id=v_album AND r.user_id=s.user_id);
 RETURN v_album;
END $$;
REVOKE ALL ON FUNCTION public.ding_import_itunes(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ding_import_itunes(text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.ding_finish_import(p_key text,p_token uuid,p_release_id uuid,p_group_id uuid,p_details jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_album uuid; v_track jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.catalog_import_leases WHERE import_key=p_key AND token=p_token AND user_id=auth.uid() AND expires_at>now() FOR UPDATE)
    THEN RAISE EXCEPTION 'Import lease expired'; END IF;
  IF p_group_id IS NULL THEN
    IF p_key IS DISTINCT FROM ('release:' || p_release_id::text) THEN
      RAISE EXCEPTION 'Import key mismatch';
    END IF;
  ELSIF p_key IS DISTINCT FROM ('release-group:' || p_group_id::text) THEN
    RAISE EXCEPTION 'Import key mismatch';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_release_id::text, 1));
  IF p_details IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended(lower(btrim(p_details->>'title'))||':'||lower(btrim(p_details->>'artist')),2)); END IF;
  SELECT album_id INTO v_album FROM public.album_external_refs WHERE entity_type='release' AND external_id=p_release_id::text;
  IF v_album IS NULL THEN SELECT id INTO v_album FROM public.albums WHERE external_id=p_release_id::text; END IF;
  IF v_album IS NULL AND p_details IS NOT NULL THEN v_album:=public.ding_matching_album(p_details); END IF;
  IF v_album IS NULL THEN
    IF p_details IS NULL THEN RAISE EXCEPTION 'Album details required'; END IF;
    INSERT INTO public.albums(external_id,title,artist_name,cover_url,release_date)
      VALUES(p_release_id::text,p_details->>'title',p_details->>'artist',p_details->>'coverUrl',p_details->>'year') RETURNING id INTO v_album;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.tracks WHERE album_id=v_album) AND p_details IS NOT NULL THEN
    FOR v_track IN SELECT value FROM jsonb_array_elements(COALESCE(p_details->'tracks','[]'::jsonb)) LOOP
      INSERT INTO public.tracks(album_id,title,track_number,duration_ms)
        VALUES(v_album,v_track->>'title',(v_track->>'position')::integer,(v_track->>'durationMs')::integer);
    END LOOP;
  END IF;
  IF p_group_id IS NOT NULL THEN
    INSERT INTO public.album_groups(release_group_id,album_id) VALUES(p_group_id,v_album) ON CONFLICT(release_group_id) DO NOTHING;
    SELECT album_id INTO v_album FROM public.album_groups WHERE release_group_id=p_group_id;
    DELETE FROM public.saved_albums s WHERE s.entity_type='release-group' AND s.external_id=p_group_id::text
      AND EXISTS(SELECT 1 FROM public.album_ratings r WHERE r.user_id=s.user_id AND r.album_id=v_album);
  END IF;
  INSERT INTO public.album_external_refs VALUES('release',p_release_id::text,v_album) ON CONFLICT DO NOTHING;
  IF p_group_id IS NOT NULL THEN INSERT INTO public.album_external_refs VALUES('release-group',p_group_id::text,v_album) ON CONFLICT DO NOTHING; END IF;
  DELETE FROM public.saved_albums s WHERE EXISTS(SELECT 1 FROM public.album_external_refs e WHERE e.album_id=v_album AND e.entity_type=s.entity_type AND e.external_id=s.external_id) AND EXISTS(SELECT 1 FROM public.album_ratings r WHERE r.album_id=v_album AND r.user_id=s.user_id);
  DELETE FROM public.catalog_import_leases WHERE import_key=p_key AND token=p_token;
  RETURN v_album;
END $$;

COMMIT;
