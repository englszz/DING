"use server";

import { createClient } from "@/lib/supabase/server";
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

  // Convert data URL to buffer
  const base64 = dataUrl.split(",")[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const ext = mimeType.split("/")[1] || "png";
  const path = `${user.id}/avatar.${ext}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, bytes, {
      contentType: mimeType,
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
      website_url: links.website_url || null,
      instagram_url: links.instagram_url || null,
      twitter_url: links.twitter_url || null,
      facebook_url: links.facebook_url || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) throw error;
  return { success: true };
}
