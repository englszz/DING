-- DING — REVIEW COMMENTS (Forum) migration
-- Paste this block into the Supabase SQL Editor (https://supabase.com/dashboard) and run it.

-- 11. REVIEW COMMENTS TABLE (Forum: replies to album reviews)
CREATE TABLE IF NOT EXISTS public.review_comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  album_rating_id UUID REFERENCES public.album_ratings(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) <= 2000),
  parent_id UUID REFERENCES public.review_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.review_comments ENABLE ROW LEVEL SECURITY;

-- Review comments: viewable by everyone; authenticated users can comment; authors can edit/delete own
DROP POLICY IF EXISTS "Review comments viewable by everyone" ON public.review_comments;
CREATE POLICY "Review comments viewable by everyone" ON public.review_comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert review comments" ON public.review_comments;
CREATE POLICY "Authenticated users can insert review comments" ON public.review_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own review comments" ON public.review_comments;
CREATE POLICY "Users can update own review comments" ON public.review_comments FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own review comments" ON public.review_comments;
CREATE POLICY "Users can delete own review comments" ON public.review_comments FOR DELETE USING (auth.uid() = user_id);