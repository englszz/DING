-- Apply after 20260917_song_reviews_and_top_three.sql. Transactional; safe to rerun.
BEGIN;
-- Restrictive policies also constrain older permissive FOR ALL policies.
DROP POLICY IF EXISTS ding_profile_privacy ON public.profiles;
CREATE POLICY ding_profile_privacy ON public.profiles AS RESTRICTIVE FOR SELECT
 USING(id=auth.uid() OR privacy='public');
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['album_ratings','listen_log','track_ratings','track_comments','song_reviews','album_top_three'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('DROP POLICY IF EXISTS ding_owner_privacy ON public.%I',t);
  EXECUTE format('CREATE POLICY ding_owner_privacy ON public.%I AS RESTRICTIVE FOR SELECT USING (user_id=auth.uid() OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=user_id AND p.privacy=''public''))',t);
 END LOOP;
END $$;
DROP POLICY IF EXISTS ding_track_review_privacy ON public.track_reviews;
CREATE POLICY ding_track_review_privacy ON public.track_reviews AS RESTRICTIVE FOR SELECT
 USING(EXISTS(SELECT 1 FROM public.album_ratings r WHERE r.id=album_rating_id));
DROP POLICY IF EXISTS ding_discussion_privacy ON public.review_comments;
CREATE POLICY ding_discussion_privacy ON public.review_comments AS RESTRICTIVE FOR SELECT USING(
 EXISTS(SELECT 1 FROM public.album_ratings r WHERE r.id=album_rating_id)
 AND (user_id=auth.uid() OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=user_id AND p.privacy='public')));
DROP POLICY IF EXISTS ding_discussion_insert ON public.review_comments;
CREATE POLICY ding_discussion_insert ON public.review_comments AS RESTRICTIVE FOR INSERT WITH CHECK(
 user_id=auth.uid() AND EXISTS(SELECT 1 FROM public.album_ratings r WHERE r.id=album_rating_id));
DROP POLICY IF EXISTS ding_discussion_update ON public.review_comments;
CREATE POLICY ding_discussion_update ON public.review_comments AS RESTRICTIVE FOR UPDATE
 USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid() AND EXISTS(SELECT 1 FROM public.album_ratings r WHERE r.id=album_rating_id));
-- Replies cannot target a different review. Existing comments are preserved.
CREATE OR REPLACE FUNCTION public.ding_validate_comment_parent() RETURNS trigger
 LANGUAGE plpgsql SET search_path=public,pg_temp AS $$ BEGIN
 IF NEW.parent_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.review_comments p WHERE p.id=NEW.parent_id AND p.album_rating_id=NEW.album_rating_id)
 THEN RAISE EXCEPTION 'Invalid reply target'; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS ding_validate_comment_parent ON public.review_comments;
CREATE TRIGGER ding_validate_comment_parent BEFORE INSERT OR UPDATE ON public.review_comments FOR EACH ROW EXECUTE FUNCTION public.ding_validate_comment_parent();

-- Clients must never be able to promote themselves to administrator.
REVOKE UPDATE,INSERT,DELETE ON public.profiles FROM anon,authenticated;
GRANT UPDATE(username,display_name,avatar_url,bio,privacy,website_url,instagram_url,twitter_url,facebook_url,updated_at) ON public.profiles TO authenticated;
-- Defense in depth even if a broad table grant is reintroduced later.
CREATE OR REPLACE FUNCTION public.ding_protect_profile_identity() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$ BEGIN
 IF auth.uid() IS NOT NULL AND (NEW.is_admin IS DISTINCT FROM OLD.is_admin OR NEW.id IS DISTINCT FROM OLD.id) THEN
 RAISE EXCEPTION 'Profile privilege fields are server-managed'; END IF;
 RETURN NEW; END $$;
DROP TRIGGER IF EXISTS ding_protect_profile_identity ON public.profiles;
CREATE TRIGGER ding_protect_profile_identity BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.ding_protect_profile_identity();
ALTER FUNCTION public.handle_new_user() SET search_path=public,pg_temp;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC,anon,authenticated;
-- Avatar uploads are public assets: restrict content types and size at Storage itself.
UPDATE storage.buckets SET file_size_limit=2097152,allowed_mime_types=ARRAY['image/png','image/jpeg','image/webp'] WHERE id='avatars';
-- NOT VALID preserves older text, while checking every new or edited row.
ALTER TABLE public.album_ratings DROP CONSTRAINT IF EXISTS ding_review_size;
ALTER TABLE public.album_ratings ADD CONSTRAINT ding_review_size CHECK (char_length(review)<=10000) NOT VALID;
ALTER TABLE public.song_reviews DROP CONSTRAINT IF EXISTS ding_song_review_size;
ALTER TABLE public.song_reviews ADD CONSTRAINT ding_song_review_size CHECK (char_length(content)<=2000) NOT VALID;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS ding_profile_size;
ALTER TABLE public.profiles ADD CONSTRAINT ding_profile_size CHECK (char_length(bio)<=2000 AND char_length(display_name)<=200 AND char_length(username)<=200 AND char_length(avatar_url)<=2048) NOT VALID;
-- Database-side limits apply even when someone bypasses the web UI.
CREATE SCHEMA IF NOT EXISTS ding_private;
REVOKE ALL ON SCHEMA ding_private FROM PUBLIC,anon,authenticated;
CREATE TABLE IF NOT EXISTS ding_private.write_windows(user_id uuid NOT NULL,window_start timestamptz NOT NULL,hits integer NOT NULL,PRIMARY KEY(user_id));
CREATE OR REPLACE FUNCTION public.ding_limit_user_writes() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=auth.uid(); n integer;
BEGIN
 IF u IS NOT NULL THEN
 INSERT INTO ding_private.write_windows VALUES(u,date_trunc('minute',now()),1)
 ON CONFLICT(user_id) DO UPDATE SET window_start=EXCLUDED.window_start,hits=CASE WHEN write_windows.window_start=EXCLUDED.window_start THEN write_windows.hits+1 ELSE 1 END RETURNING hits INTO n;
 IF n>120 THEN RAISE EXCEPTION 'Too many writes; retry in one minute'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.ding_limit_user_writes() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['profiles','album_ratings','track_ratings','track_reviews','listen_log','review_comments','song_reviews','song_review_comments','album_top_three','saved_albums'] LOOP
 EXECUTE format('DROP TRIGGER IF EXISTS ding_limit_user_writes ON public.%I',t);
 EXECUTE format('CREATE TRIGGER ding_limit_user_writes BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.ding_limit_user_writes()',t);
 END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS ding_private.search_windows(user_id uuid PRIMARY KEY,window_start timestamptz NOT NULL,hits integer NOT NULL);
CREATE OR REPLACE FUNCTION public.ding_allow_search() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=auth.uid(); n integer;
BEGIN
 IF u IS NULL THEN RETURN false; END IF;
 INSERT INTO ding_private.search_windows VALUES(u,date_trunc('minute',now()),1)
 ON CONFLICT(user_id) DO UPDATE SET window_start=EXCLUDED.window_start,hits=CASE WHEN search_windows.window_start=EXCLUDED.window_start THEN LEAST(search_windows.hits+1,61) ELSE 1 END RETURNING hits INTO n;
 RETURN n<=60;
END $$;
REVOKE ALL ON FUNCTION public.ding_allow_search() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ding_allow_search() TO authenticated;
COMMIT;
