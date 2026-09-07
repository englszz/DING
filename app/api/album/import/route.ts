import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAlbumDetails, getGroupEditions } from "@/lib/musicbrainz/api";

const importSchema = z.object({
  mbid: z.string().uuid(),
  entityType: z.enum(["release", "release-group"]).default("release"),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid MBID" }, { status: 400 });
  }

  let { mbid } = parsed.data;

  if (parsed.data.entityType === "release-group") {
    try {
      const editions = await getGroupEditions(mbid);
      // Keep legacy album IDs, tracks and reviews intact. Match every edition,
      // not just the edition selected for new imports.
      for (let offset = 0; offset < editions.length; offset += 100) {
        const { data: saved, error } = await supabase.from("albums").select("id")
          .in("external_id", editions.slice(offset, offset + 100).map(edition => edition.id))
          .order("created_at", { ascending: true }).limit(1);
        if (error) throw error;
        if (saved?.[0]) return NextResponse.json({ albumId: saved[0].id });
      }
      const edition = editions.find(item => item.status === "Official");
      if (!edition) return NextResponse.json({ error: "No encontramos una edición oficial de este álbum." }, { status: 404 });
      mbid = edition.id;
    } catch (error) {
      console.error("Album edition resolution failed:", error);
      return NextResponse.json({ error: "No pudimos abrir este álbum. Inténtalo de nuevo." }, { status: 502 });
    }
  }

  // Check if album already exists in DB (skip MusicBrainz call entirely)
  const { data: existing } = await supabase
    .from("albums")
    .select("id")
    .eq("external_id", mbid)
    .single();

  if (existing) {
    return NextResponse.json({ albumId: existing.id });
  }

  // Fetch from MusicBrainz with retry
  let mbAlbum;
  try {
    mbAlbum = await getAlbumDetails(mbid);
  } catch {
    return NextResponse.json({ error: "No pudimos cargar el álbum. Inténtalo de nuevo." }, { status: 502 });
  }

  if (!mbAlbum) {
    return NextResponse.json(
      { error: "Album not found in MusicBrainz" },
      { status: 404 }
    );
  }

  const { data: album, error: albumError } = await supabase
    .from("albums")
    .upsert(
      {
        external_id: mbAlbum.id,
        title: mbAlbum.title,
        artist_name: mbAlbum.artist,
        cover_url: mbAlbum.coverUrl,
        release_date: mbAlbum.year,
      },
      { onConflict: "external_id", ignoreDuplicates: true }
    )
    .select("id")
    .maybeSingle();

  // Another request may have imported this release in the meantime.
  if (!albumError && !album) {
    const { data: concurrent } = await supabase.from("albums").select("id")
      .eq("external_id", mbid).single();
    if (concurrent) return NextResponse.json({ albumId: concurrent.id });
  }

  if (albumError || !album) {
    console.error("Album upsert error:", albumError);
    return NextResponse.json(
      { error: "Failed to save album" },
      { status: 500 }
    );
  }

  const albumId = album.id;

  if (mbAlbum.tracks && mbAlbum.tracks.length > 0) {
    const trackRows = mbAlbum.tracks.map((t) => ({
      album_id: albumId,
      title: t.title,
      track_number: t.position,
      duration_ms: t.durationMs,
    }));

    const { error: tracksError } = await supabase
      .from("tracks")
      .insert(trackRows);

    if (tracksError) {
      console.error("Tracks insert error:", tracksError);
    }
  }

  return NextResponse.json({ albumId });
}
