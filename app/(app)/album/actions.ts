"use server";

import { createClient } from "@/lib/supabase/server";

export async function saveAlbumRating(
  albumId: string,
  rating: number,
  review: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  // Validate rating
  const rounded = Math.round(rating * 10) / 10;
  if (rounded < 0 || rounded > 10) throw new Error("Invalid rating");

  const { error } = await supabase.from("album_ratings").upsert(
    {
      user_id: user.id,
      album_id: albumId,
      rating: rounded,
      review: review || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,album_id" }
  );

  if (error) throw error;
  return { success: true };
}

export async function registerListen(albumId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("listen_log").insert({
    user_id: user.id,
    album_id: albumId,
    listened_at: new Date().toISOString(),
  });

  if (error) throw error;
  return { success: true };
}

export async function saveTrackRating(trackId: string, rating: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const rounded = Math.round(rating * 10) / 10;
  if (rounded < 0 || rounded > 10) throw new Error("Invalid rating");

  const { error } = await supabase.from("track_ratings").upsert(
    {
      user_id: user.id,
      track_id: trackId,
      rating: rounded,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,track_id" }
  );

  if (error) throw error;
  return { success: true };
}

export async function deleteTrackRating(trackId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("track_ratings")
    .delete()
    .eq("user_id", user.id)
    .eq("track_id", trackId);

  if (error) throw error;
  return { success: true };
}

export async function saveTrackReview(
  albumRatingId: string,
  trackId: string,
  rating: number,
  comment: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  // Verify the album_rating belongs to this user
  const { data: existing } = await supabase
    .from("album_ratings")
    .select("id")
    .eq("id", albumRatingId)
    .eq("user_id", user.id)
    .single();

  if (!existing) throw new Error("Not authorized");

  const rounded = Math.round(rating * 10) / 10;
  if (rounded < 0 || rounded > 10) throw new Error("Invalid rating");

  const { error } = await supabase.from("track_reviews").upsert(
    {
      album_rating_id: albumRatingId,
      track_id: trackId,
      rating: rounded,
      comment: comment || null,
    },
    { onConflict: "album_rating_id,track_id" }
  );

  if (error) throw error;
  return { success: true };
}
