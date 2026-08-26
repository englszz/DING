import { createClient } from "@/lib/supabase/server";
import type { Album, Track, AlbumRating, TrackReview } from "@/types";

/**
 * Fetch a single album with all its tracks by Supabase UUID.
 */
export async function getAlbumWithTracks(albumId: string) {
  const supabase = await createClient();

  const { data: album, error: albumErr } = await supabase
    .from("albums")
    .select("*")
    .eq("id", albumId)
    .single();

  if (albumErr || !album) return null;

  const { data: tracks } = await supabase
    .from("tracks")
    .select("*")
    .eq("album_id", albumId)
    .order("track_number", { ascending: true });

  return { album: album as Album, tracks: (tracks || []) as Track[] };
}

/**
 * Fetch the current user's rating for a specific album.
 */
export async function getUserAlbumRating(userId: string, albumId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("album_ratings")
    .select("*")
    .eq("user_id", userId)
    .eq("album_id", albumId)
    .single();

  return (data as AlbumRating | null);
}

/**
 * Fetch all track reviews for a given album rating.
 */
export async function getTrackReviews(albumRatingId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("track_reviews")
    .select("*")
    .eq("album_rating_id", albumRatingId)
    .order("created_at", { ascending: true });

  return (data || []) as TrackReview[];
}
