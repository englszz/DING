-- Apply after 20260908_itunes_fallback.sql. Only missing artwork is filled.
BEGIN;
ALTER TABLE public.albums ADD COLUMN IF NOT EXISTS artwork_itunes_id text;
CREATE OR REPLACE FUNCTION public.ding_set_itunes_artwork(p_id text,p_url text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF p_id IS NULL OR p_id !~ '^[0-9]{1,20}$' OR p_url IS NULL OR p_url !~ '^https://is[0-9]+-ssl[.]mzstatic[.]com/image/' THEN RAISE EXCEPTION 'Invalid artwork'; END IF;
 UPDATE public.albums a SET cover_url=p_url,artwork_itunes_id=p_id WHERE (a.cover_url IS NULL OR a.cover_url='') AND
 (a.external_id='itunes:'||p_id OR EXISTS(SELECT 1 FROM public.album_external_refs r WHERE r.entity_type='itunes' AND r.external_id=p_id AND r.album_id=a.id));
 UPDATE public.saved_albums SET cover_url=p_url WHERE entity_type='itunes' AND external_id=p_id AND (cover_url IS NULL OR cover_url='');
END $$;
REVOKE ALL ON FUNCTION public.ding_set_itunes_artwork(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ding_set_itunes_artwork(text,text) TO authenticated;

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
 IF p_details->>'coverUrl' IS NOT NULL THEN PERFORM public.ding_set_itunes_artwork(p_external_id,p_details->>'coverUrl'); END IF;
 DELETE FROM public.saved_albums s WHERE s.entity_type='itunes' AND s.external_id=p_external_id AND EXISTS(SELECT 1 FROM public.album_ratings r WHERE r.album_id=v_album AND r.user_id=s.user_id);
 RETURN v_album;
END $$;


UPDATE public.albums SET cover_url='https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/7f/ab/ba/7fabbae7-d92a-f59e-352b-7b9d1e960feb/075679924872.jpg/600x600bb.jpg',artwork_itunes_id='986011611' WHERE external_id='itunes:986011611' AND (cover_url IS NULL OR cover_url='');
UPDATE public.saved_albums SET cover_url='https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/7f/ab/ba/7fabbae7-d92a-f59e-352b-7b9d1e960feb/075679924872.jpg/600x600bb.jpg' WHERE entity_type='itunes' AND external_id='986011611' AND (cover_url IS NULL OR cover_url='');

COMMIT;
