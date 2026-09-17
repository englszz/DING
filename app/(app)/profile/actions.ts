"use server";

import { createClient } from "@/lib/supabase/server";
import { safeProfileUrl } from "@/lib/security/validation";
import sharp from "sharp";
import { redirect } from "next/navigation";

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function updateUsername(newUsername: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const clean = newUsername.toLowerCase().trim();
  if (!/^[a-z0-9_]{3,30}$/.test(clean)) {
    throw new Error(
      "Username must be 3-30 characters: lowercase letters, numbers, underscores"
    );
  }

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", clean)
    .neq("id", user.id)
    .single();

  if (existing) {
    throw new Error("Username already taken");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ username: clean, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) throw error;
  return { success: true, username: clean };
}

export async function updateAvatarFile(dataUrl: string, mimeType: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  if (!["image/png", "image/jpeg", "image/webp"].includes(mimeType) || dataUrl.length > 2800000 || !dataUrl.startsWith(`data:${mimeType};base64,`)) throw new Error("Usa una imagen PNG, JPEG o WebP de hasta 2 MB.");
  // Convert data URL to buffer
  const base64 = dataUrl.split(",")[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  if (bytes.length > 2097152) throw new Error("La imagen supera 2 MB.");
  const cleanImage = await sharp(bytes, { limitInputPixels: 16000000 }).rotate().resize(512,512,{fit:"cover",withoutEnlargement:true}).webp().toBuffer();
  const ext = "webp";
  const path = `${user.id}/avatar.${ext}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, cleanImage, {
      contentType: "image/webp",
      upsert: true,
    });

  if (uploadError) throw uploadError;

  // Get public URL
  const { data: urlData } = supabase.storage
    .from("avatars")
    .getPublicUrl(path);

  const publicUrl = urlData.publicUrl;

  // Update profile
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) throw error;
  return { success: true, url: publicUrl };
}

export async function updateBio(bio: string) {
  if (typeof bio !== "string" || bio.length > 2000) throw new Error("La biografía admite hasta 2000 caracteres.");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("profiles")
    .update({ bio, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) throw error;
  return { success: true };
}

export async function deleteAlbumRating(ratingId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  // Get the album id first so we can also remove it from the listen diary
  const { data: rating } = await supabase
    .from("album_ratings")
    .select("album_id")
    .eq("id", ratingId)
    .eq("user_id", user.id)
    .single();

  if (rating) {
    // Remove the album from the user's listen diary
    const { error: listenError } = await supabase
      .from("listen_log")
      .delete()
      .eq("user_id", user.id)
      .eq("album_id", rating.album_id);
    if (listenError) throw listenError;
  }

  // Only delete ratings that belong to the authenticated user
  const { error } = await supabase
    .from("album_ratings")
    .delete()
    .eq("id", ratingId)
    .eq("user_id", user.id);

  if (error) throw error;
  return { success: true };
}

export async function updateSocialLinks(links: {
  website_url: string;
  instagram_url: string;
  twitter_url: string;
  facebook_url: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("profiles")
    .update({
      website_url: safeProfileUrl(links.website_url),
      instagram_url: safeProfileUrl(links.instagram_url),
      twitter_url: safeProfileUrl(links.twitter_url),
      facebook_url: safeProfileUrl(links.facebook_url),
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) throw error;
  return { success: true };
}
