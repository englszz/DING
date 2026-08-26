-- 7. TRACK RATINGS TABLE (Per-track rating, independent of album rating)
-- Execute in Supabase SQL Editor if not already created
CREATE TABLE IF NOT EXISTS public.track_ratings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  track_id UUID REFERENCES public.tracks(id) ON DELETE CASCADE NOT NULL,
  rating NUMERIC(3, 1) NOT NULL CHECK (rating >= 0.0 AND rating <= 10.0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, track_id)
);

-- RLS for track_ratings
ALTER TABLE public.track_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Track ratings viewable by everyone" ON public.track_ratings;
CREATE POLICY "Track ratings viewable by everyone" ON public.track_ratings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own track ratings" ON public.track_ratings;
CREATE POLICY "Users can manage own track ratings" ON public.track_ratings FOR ALL USING (auth.uid() = user_id);

-- 8. ADMIN FLAG for profiles
-- Execute in Supabase SQL Editor
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Set yourself as admin (replace the UUID with your auth user id)
-- UPDATE public.profiles SET is_admin = true WHERE id = 'YOUR_USER_UUID_HERE';
