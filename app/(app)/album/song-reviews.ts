"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function saveSongReview(trackId: string, content: string) {
  z.string().uuid().parse(trackId);
  const text = z.string().max(2000).parse(content.trim());
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error("Inicia sesión para escribir tu reseña.");
  const { data, error } = await db.from("song_reviews").upsert({ user_id: user.id, track_id: trackId, content: text, updated_at: new Date().toISOString() }, { onConflict: "user_id,track_id" }).select("id,content").single();
  if (error) throw new Error("No se pudo guardar la reseña. Inténtalo de nuevo.");
  revalidatePath("/album/[id]", "page");
  return data as { id: string; content: string };
}

export async function saveAlbumTopThree(albumId: string, ids: string[], importOnly = false) {
  z.string().uuid().parse(albumId);
  z.array(z.string().uuid()).length(3).refine(value => new Set(value).size === 3).parse(ids);
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error("Inicia sesión para guardar tu top 3.");
  const { error } = await db.from("album_top_three").upsert({ user_id: user.id, album_id: albumId, first_track_id: ids[0], second_track_id: ids[1], third_track_id: ids[2], updated_at: new Date().toISOString() }, { onConflict: "user_id,album_id", ignoreDuplicates: importOnly });
  if (error) throw new Error("No se pudo guardar el top 3 en tu cuenta. Tu selección local se conserva.");
  const { data, error: readError } = await db.from("album_top_three").select("first_track_id,second_track_id,third_track_id").eq("user_id", user.id).eq("album_id", albumId).single();
  if (readError) throw new Error("No pudimos confirmar el guardado. Vuelve a intentarlo.");
  revalidatePath("/album/[id]", "page");
  return [data.first_track_id, data.second_track_id, data.third_track_id] as string[];
}

export async function readSongDiscussion(reviewId: string, offset = 0) {
  z.string().uuid().parse(reviewId);
  z.number().int().min(0).max(10000).parse(offset);
  const db = await createClient();
  const { data, error } = await db.from("song_review_comments").select("id,user_id,content,profiles(username)").eq("review_id", reviewId).order("created_at", { ascending: true }).order("id").range(offset, offset + 19);
  if (error) throw new Error("No pudimos cargar la conversación.");
  return (data || []).map(row => ({ id: row.id, userId: row.user_id, content: row.content, username: (Array.isArray(row.profiles) ? row.profiles[0] : row.profiles)?.username || "Usuario" }));
}
export async function addSongDiscussionComment(reviewId: string, content: string) {
  z.string().uuid().parse(reviewId);
  const text = z.string().trim().min(1).max(2000).parse(content);
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error("Inicia sesión para comentar.");
  const { error } = await db.from("song_review_comments").insert({ review_id: reviewId, user_id: user.id, content: text });
  if (error) throw new Error("No pudimos publicar el comentario.");
}
