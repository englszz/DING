-- DING: private saved albums, public track comments and atomic catalog imports.
-- Execute this entire file ONCE in Supabase > SQL Editor > New query.
-- Safe to rerun. Does not delete albums, ratings, tracks or existing reviews.
BEGIN;

CREATE TABLE IF NOT EXISTS public.album_groups (
  release_group_id uuid PRIMARY KEY,
  album_id uuid NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS album_groups_album_idx ON public.album_groups(album_id);
ALTER TABLE public.album_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Catalog group references are public" ON public.album_groups;
CREATE POLICY "Catalog group references are public" ON public.album_groups FOR SELECT USING (true);
GRANT SELECT ON public.album_groups TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.saved_albums (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  external_id uuid NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('release', 'release-group')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 500),
  artist text NOT NULL CHECK (char_length(artist) BETWEEN 1 AND 500),
  cover_url text,
  year text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, external_id, entity_type)
);
ALTER TABLE public.saved_albums ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Only owner reads saved albums" ON public.saved_albums;
CREATE POLICY "Only owner reads saved albums" ON public.saved_albums FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Only owner removes saved albums" ON public.saved_albums;
CREATE POLICY "Only owner removes saved albums" ON public.saved_albums FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));
GRANT SELECT, DELETE ON public.saved_albums TO authenticated;
REVOKE INSERT, UPDATE ON public.saved_albums FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.track_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  track_id uuid NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, track_id)
);
CREATE INDEX IF NOT EXISTS track_comments_track_idx ON public.track_comments(track_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tracks_album_idx ON public.tracks(album_id);
CREATE INDEX IF NOT EXISTS album_ratings_album_idx ON public.album_ratings(album_id);
ALTER TABLE public.track_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Visible track comments" ON public.track_comments;
CREATE POLICY "Visible track comments" ON public.track_comments FOR SELECT USING (
  user_id = (SELECT auth.uid()) OR EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.privacy = 'public'
  )
);
DROP POLICY IF EXISTS "Own track comments insert" ON public.track_comments;
CREATE POLICY "Own track comments insert" ON public.track_comments FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Own track comments update" ON public.track_comments;
CREATE POLICY "Own track comments update" ON public.track_comments FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Own track comments delete" ON public.track_comments;
CREATE POLICY "Own track comments delete" ON public.track_comments FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));
GRANT SELECT ON public.track_comments TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.track_comments TO authenticated;

-- Serialize saving and rating per user so a rated album cannot remain pending.
CREATE OR REPLACE FUNCTION public.ding_save_album(p_external_id uuid, p_entity_type text, p_title text, p_artist text, p_cover_url text DEFAULT NULL, p_year text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_user uuid := auth.uid(); v_album uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
  IF p_entity_type = 'release-group' THEN
    SELECT album_id INTO v_album FROM public.album_groups WHERE release_group_id = p_external_id;
  ELSIF p_entity_type = 'release' THEN
    SELECT id INTO v_album FROM public.albums WHERE external_id = p_external_id::text;
  ELSE RAISE EXCEPTION 'Invalid entity type'; END IF;
  IF EXISTS (SELECT 1 FROM public.album_ratings WHERE user_id = v_user AND album_id = v_album) THEN RETURN false; END IF;
  INSERT INTO public.saved_albums(user_id,external_id,entity_type,title,artist,cover_url,year)
    VALUES(v_user,p_external_id,p_entity_type,p_title,p_artist,p_cover_url,p_year)
    ON CONFLICT (user_id,external_id,entity_type) DO NOTHING;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.ding_save_album(uuid,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ding_save_album(uuid,text,text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.ding_remove_rated_saved() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text, 0));
  DELETE FROM public.saved_albums s WHERE s.user_id = NEW.user_id AND (
    (s.entity_type='release' AND s.external_id::text = (SELECT external_id FROM public.albums WHERE id=NEW.album_id)) OR
    (s.entity_type='release-group' AND s.external_id IN (SELECT release_group_id FROM public.album_groups WHERE album_id=NEW.album_id))
  );
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ding_remove_rated_saved ON public.album_ratings;
CREATE TRIGGER ding_remove_rated_saved AFTER INSERT OR UPDATE ON public.album_ratings FOR EACH ROW EXECUTE FUNCTION public.ding_remove_rated_saved();

-- Leases prevent parallel workers importing the same entity. They expire after a crash.
CREATE TABLE IF NOT EXISTS public.catalog_import_leases (
  import_key text PRIMARY KEY, token uuid NOT NULL, user_id uuid NOT NULL,
  expires_at timestamptz NOT NULL
);
ALTER TABLE public.catalog_import_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.catalog_import_leases FROM anon, authenticated;
CREATE OR REPLACE FUNCTION public.ding_claim_import(p_key text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_token uuid := gen_random_uuid(); v_result uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_key !~ '^(release|release-group):[0-9a-f-]{36}$' THEN RAISE EXCEPTION 'Invalid import key'; END IF;
  INSERT INTO public.catalog_import_leases(import_key,token,user_id,expires_at)
    VALUES(p_key,v_token,auth.uid(),now()+interval '90 seconds')
    ON CONFLICT(import_key) DO UPDATE SET token=EXCLUDED.token,user_id=EXCLUDED.user_id,expires_at=EXCLUDED.expires_at
    WHERE catalog_import_leases.expires_at < now() RETURNING token INTO v_result;
  RETURN v_result;
END $$;
CREATE OR REPLACE FUNCTION public.ding_release_import(p_key text,p_token uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  DELETE FROM public.catalog_import_leases WHERE import_key=p_key AND token=p_token AND user_id=auth.uid();
END $$;

-- Single transaction: no partially imported albums and no deletion of existing tracks.
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
  SELECT id INTO v_album FROM public.albums WHERE external_id=p_release_id::text;
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
    DELETE FROM public.saved_albums s WHERE s.entity_type='release-group' AND s.external_id=p_group_id
      AND EXISTS(SELECT 1 FROM public.album_ratings r WHERE r.user_id=s.user_id AND r.album_id=v_album);
  END IF;
  DELETE FROM public.catalog_import_leases WHERE import_key=p_key AND token=p_token;
  RETURN v_album;
END $$;
REVOKE ALL ON FUNCTION public.ding_claim_import(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ding_release_import(text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ding_finish_import(text,uuid,uuid,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ding_claim_import(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ding_release_import(text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ding_finish_import(text,uuid,uuid,uuid,jsonb) TO authenticated;

COMMIT;
