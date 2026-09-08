"use server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
const uuid = z.string().uuid();
export async function readTrackComments(trackId: string, offset = 0) {
  uuid.parse(trackId);
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  const { data, error } = await db
    .from("track_comments")
    .select("id,user_id,content,profiles(username)")
    .eq("track_id", trackId)
    .order("created_at", { ascending: false })
    .range(Math.max(0, offset), Math.max(0, offset) + 19);
  if (error) throw new Error("No pudimos cargar los comentarios.");
  const own = user
    ? await db
        .from("track_comments")
        .select("content")
        .eq("track_id", trackId)
        .eq("user_id", user.id)
        .maybeSingle()
    : null;
  if (own?.error) throw new Error("No pudimos cargar tu comentario.");
  return {
    items: (data || []).map((item) => ({
      id: item.id,
      content: item.content,
      username:
        (Array.isArray(item.profiles) ? item.profiles[0] : item.profiles)
          ?.username || "Usuario",
    })),
    own: own?.data?.content || "",
    signedIn: !!user,
  };
}
export async function writeTrackComment(trackId: string, content: string) {
  uuid.parse(trackId);
  const trimmed = z.string().max(2000).parse(content.trim());
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Inicia sesión para comentar.");
  const result = trimmed
    ? await db
        .from("track_comments")
        .upsert(
          {
            user_id: user.id,
            track_id: trackId,
            content: trimmed,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,track_id" },
        )
    : await db
        .from("track_comments")
        .delete()
        .eq("user_id", user.id)
        .eq("track_id", trackId);
  if (result.error) throw new Error("No pudimos guardar el comentario.");
}
