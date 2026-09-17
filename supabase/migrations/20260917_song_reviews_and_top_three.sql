-- DING: personal song reviews, separate discussions and account-synced top three.
-- Run as project owner in Supabase SQL Editor. Atomic and safe to rerun.
-- Original track_comments and track_reviews are retained; no originals are deleted.
BEGIN;

CREATE TABLE IF NOT EXISTS public.song_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  track_id uuid NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  source_comment_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, track_id)
);
-- Empty content is a deliberate removal, preventing reruns from restoring old text.
-- Imported text is kept verbatim; the app limits new writing to 2,000 characters.
ALTER TABLE public.song_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Visible personal song reviews" ON public.song_reviews;
CREATE POLICY "Visible personal song reviews" ON public.song_reviews FOR SELECT USING (
  user_id = (SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.privacy = 'public')
);
DROP POLICY IF EXISTS "Own song reviews insert" ON public.song_reviews;
CREATE POLICY "Own song reviews insert" ON public.song_reviews FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Own song reviews update" ON public.song_reviews;
CREATE POLICY "Own song reviews update" ON public.song_reviews FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
GRANT SELECT ON public.song_reviews TO anon, authenticated;
GRANT INSERT, UPDATE ON public.song_reviews TO authenticated;
REVOKE DELETE ON public.song_reviews FROM anon, authenticated;

INSERT INTO public.song_reviews(user_id,track_id,content,source_comment_id,created_at,updated_at)
  SELECT user_id,track_id,content,id,created_at,updated_at FROM public.track_comments
  ON CONFLICT(user_id,track_id) DO NOTHING;
-- Also preserve the older optional text attached to an album rating.
INSERT INTO public.song_reviews(user_id,track_id,content,created_at,updated_at)
  SELECT a.user_id,r.track_id,r.comment,r.created_at,r.created_at
  FROM public.track_reviews r JOIN public.album_ratings a ON a.id = r.album_rating_id
  JOIN public.tracks t ON t.id = r.track_id AND t.album_id = a.album_id
  WHERE r.comment IS NOT NULL AND btrim(r.comment) <> ''
  ON CONFLICT(user_id,track_id) DO NOTHING;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.track_comments c WHERE NOT EXISTS (
    SELECT 1 FROM public.song_reviews r WHERE r.user_id=c.user_id AND r.track_id=c.track_id
  )) THEN RAISE EXCEPTION 'Review migration incomplete: originals preserved, rolling back'; END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.album_top_three (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  album_id uuid NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
  first_track_id uuid NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  second_track_id uuid NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  third_track_id uuid NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,album_id),
  CHECK(first_track_id <> second_track_id AND first_track_id <> third_track_id AND second_track_id <> third_track_id)
);
CREATE OR REPLACE FUNCTION public.ding_validate_top_three() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$ BEGIN
  IF (SELECT count(*) FROM public.tracks WHERE album_id=NEW.album_id AND id=ANY(ARRAY[NEW.first_track_id,NEW.second_track_id,NEW.third_track_id])) <> 3
    THEN RAISE EXCEPTION 'Choose three different tracks from this album'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ding_validate_top_three ON public.album_top_three;
CREATE TRIGGER ding_validate_top_three BEFORE INSERT OR UPDATE ON public.album_top_three FOR EACH ROW EXECUTE FUNCTION public.ding_validate_top_three();
ALTER TABLE public.album_top_three ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Visible top three" ON public.album_top_three;
CREATE POLICY "Visible top three" ON public.album_top_three FOR SELECT USING (
  user_id = (SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=user_id AND p.privacy='public')
);
DROP POLICY IF EXISTS "Own top three insert" ON public.album_top_three;
CREATE POLICY "Own top three insert" ON public.album_top_three FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Own top three update" ON public.album_top_three;
CREATE POLICY "Own top three update" ON public.album_top_three FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
GRANT SELECT ON public.album_top_three TO anon, authenticated;
GRANT INSERT, UPDATE ON public.album_top_three TO authenticated;

CREATE TABLE IF NOT EXISTS public.song_review_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.song_reviews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS song_review_comments_review_idx ON public.song_review_comments(review_id,created_at);
ALTER TABLE public.song_review_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Visible song discussions" ON public.song_review_comments;
CREATE POLICY "Visible song discussions" ON public.song_review_comments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.song_reviews r WHERE r.id=review_id AND btrim(r.content)<>'')
  AND (user_id=(SELECT auth.uid()) OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=user_id AND p.privacy='public'))
);
DROP POLICY IF EXISTS "Write visible song discussion" ON public.song_review_comments;
CREATE POLICY "Write visible song discussion" ON public.song_review_comments FOR INSERT TO authenticated WITH CHECK (
  user_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.song_reviews r WHERE r.id=review_id AND btrim(r.content)<>'')
);
DROP POLICY IF EXISTS "Remove own song comment" ON public.song_review_comments;
CREATE POLICY "Remove own song comment" ON public.song_review_comments FOR DELETE TO authenticated USING(user_id=(SELECT auth.uid()));
GRANT SELECT ON public.song_review_comments TO anon,authenticated;
GRANT INSERT,DELETE ON public.song_review_comments TO authenticated;
COMMIT;

-- Verification: all original comments remain, and each has a review destination.
SELECT count(*) AS original_comments,
       count(r.id) AS comments_with_review,
       count(*) FILTER (WHERE c.content = r.content) AS identical_texts
FROM public.track_comments c LEFT JOIN public.song_reviews r ON r.user_id=c.user_id AND r.track_id=c.track_id;
