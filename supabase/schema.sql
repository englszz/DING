-- ─────────────────────────────────────────────────────────────────────────────
-- DING — COMPLETE SUPABASE DATABASE SCHEMA
-- Execute this SQL script in the Supabase SQL Editor (https://supabase.com/dashboard)
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  privacy TEXT DEFAULT 'public' CHECK (privacy IN ('public', 'private')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ALBUMS TABLE (Catalog from MusicBrainz MBID)
CREATE TABLE IF NOT EXISTS public.albums (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  external_id TEXT UNIQUE NOT NULL, -- MusicBrainz MBID
  title TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  artist_external_id TEXT,
  cover_url TEXT,
  release_date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TRACKS TABLE (Songs per album)
CREATE TABLE IF NOT EXISTS public.tracks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  album_id UUID REFERENCES public.albums(id) ON DELETE CASCADE NOT NULL,
  external_id TEXT,
  title TEXT NOT NULL,
  track_number INT NOT NULL,
  duration_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ALBUM RATINGS TABLE (0.0 to 10.0 rating + optional review text)
CREATE TABLE IF NOT EXISTS public.album_ratings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  album_id UUID REFERENCES public.albums(id) ON DELETE CASCADE NOT NULL,
  rating NUMERIC(3, 1) NOT NULL CHECK (rating >= 0.0 AND rating <= 10.0),
  review TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, album_id)
);

-- 5. LISTEN LOG TABLE (Chronological diary, permits re-listens)
CREATE TABLE IF NOT EXISTS public.listen_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  album_id UUID REFERENCES public.albums(id) ON DELETE CASCADE NOT NULL,
  listened_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TRACK REVIEWS TABLE (Optional per-track rating)
CREATE TABLE IF NOT EXISTS public.track_reviews (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  album_rating_id UUID REFERENCES public.album_ratings(id) ON DELETE CASCADE NOT NULL,
  track_id UUID REFERENCES public.tracks(id) ON DELETE CASCADE NOT NULL,
  rating NUMERIC(3, 1) NOT NULL CHECK (rating >= 0.0 AND rating <= 10.0),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(album_rating_id, track_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- AUTOMATIC PROFILE CREATION TRIGGER (Google OAuth Avatar Sync)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  raw_username TEXT;
  clean_username TEXT;
BEGIN
  -- Extract username from metadata or email prefix
  raw_username := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    SPLIT_PART(NEW.email, '@', 1)
  );

  -- Sanitize username: replace spaces with '_' and lowercase
  clean_username := LOWER(REGEXP_REPLACE(raw_username, '[^a-zA-Z0-9_]', '_', 'g'));
  
  -- Append short random string if username collision occurs
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = clean_username) THEN
    clean_username := clean_username || '_' || SUBSTRING(NEW.id::text, 1, 4);
  END IF;

  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    clean_username,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', clean_username),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.album_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listen_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.track_reviews ENABLE ROW LEVEL SECURITY;

-- Profiles: Anyone can view public profiles; Users can edit their own profile
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Albums & Tracks: Anyone can read music catalog; Authenticated users can insert
DROP POLICY IF EXISTS "Albums viewable by everyone" ON public.albums;
CREATE POLICY "Albums viewable by everyone" ON public.albums FOR SELECT USING (true);
DROP POLICY IF EXISTS "Albums insertable by authenticated users" ON public.albums;
CREATE POLICY "Albums insertable by authenticated users" ON public.albums FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Tracks viewable by everyone" ON public.tracks;
CREATE POLICY "Tracks viewable by everyone" ON public.tracks FOR SELECT USING (true);
DROP POLICY IF EXISTS "Tracks insertable by authenticated users" ON public.tracks;
CREATE POLICY "Tracks insertable by authenticated users" ON public.tracks FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Album Ratings: Public profiles ratings viewable by everyone; Users control their own ratings
DROP POLICY IF EXISTS "Album ratings viewable by everyone" ON public.album_ratings;
CREATE POLICY "Album ratings viewable by everyone" ON public.album_ratings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can manage own ratings" ON public.album_ratings;
CREATE POLICY "Users can manage own ratings" ON public.album_ratings FOR ALL USING (auth.uid() = user_id);

-- Listen Log: Viewable by everyone; Users manage their own listen logs
DROP POLICY IF EXISTS "Listen logs viewable by everyone" ON public.listen_log;
CREATE POLICY "Listen logs viewable by everyone" ON public.listen_log FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can manage own listen log" ON public.listen_log;
CREATE POLICY "Users can manage own listen log" ON public.listen_log FOR ALL USING (auth.uid() = user_id);

-- Track Reviews: Viewable by everyone; Users manage their own track reviews
DROP POLICY IF EXISTS "Track reviews viewable by everyone" ON public.track_reviews;
CREATE POLICY "Track reviews viewable by everyone" ON public.track_reviews FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can manage own track reviews" ON public.track_reviews;
CREATE POLICY "Users can manage own track reviews" ON public.track_reviews FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.album_ratings
    WHERE id = track_reviews.album_rating_id AND user_id = auth.uid()
  )
);
