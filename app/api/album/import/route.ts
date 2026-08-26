import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAlbumDetails } from "@/lib/musicbrainz/api";

const importSchema = z.object({
  mbid: z.string().uuid(),
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

  const { mbid } = parsed.data;

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
  let mbAlbum = await getAlbumDetails(mbid);
  if (!mbAlbum) {
    // Retry once after 1 second
    await new Promise((r) => setTimeout(r, 1000));
    mbAlbum = await getAlbumDetails(mbid);
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
      { onConflict: "external_id" }
    )
    .select("id")
    .single();

  if (albumError || !album) {
    console.error("Album upsert error:", albumError);
    return NextResponse.json(
      { error: "Failed to save album" },
      { status: 500 }
    );
  }

  const albumId = album.id;

  await supabase.from("tracks").delete().eq("album_id", albumId);

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
