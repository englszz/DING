import { NextResponse } from "next/server";
import { z } from "zod";
import { getGroupEditions } from "@/lib/musicbrainz/api";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const parsed = z.string().uuid().safeParse(new URL(request.url).searchParams.get("id"));
  if (!parsed.success) return NextResponse.json({ error: "Álbum inválido." }, { status: 400 });
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para ver las ediciones." }, { status: 401 });
  try {
    const releases = await getGroupEditions(parsed.data, AbortSignal.any([request.signal, AbortSignal.timeout(20000)]));
    return NextResponse.json({ editions: releases.filter(release => release.status === "Official").map(release => ({
      mbid: release.id,
      entityType: "release",
      title: release.title,
      artist: (release["artist-credit"] || []).map(credit => `${credit.name || credit.artist?.name || ""}${credit.joinphrase || ""}`).join(""),
      year: release.date?.slice(0, 4),
      editionDescription: release.disambiguation || "",
      country: release.country,
      coverUrl: release["cover-art-archive"]?.front ? `https://coverartarchive.org/release/${release.id}/front-500` : undefined,
    })) });
  } catch {
    return NextResponse.json({ error: "No pudimos cargar las ediciones. Inténtalo de nuevo." }, { status: 502 });
  }
}
