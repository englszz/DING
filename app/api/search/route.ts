import { NextResponse } from "next/server";
import { z } from "zod";
import { searchAlbums, searchArtists, getArtistReleases } from "@/lib/musicbrainz/api";
import { createClient } from "@/lib/supabase/server";

import { releaseKinds } from "@/lib/musicbrainz/search";

const searchSchema = z.object({
  q: z.string().trim().min(2).max(200),
  type: z.enum(["albums", "users", "artists"]).default("albums"),
  kind: z.enum(releaseKinds).default("album"),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = searchSchema.safeParse({
    q: searchParams.get("q") || "",
    type: searchParams.get("type") || "albums",
    kind: searchParams.get("kind") || "album",
  });

  if (!parsed.success) {
    return NextResponse.json({ albums: [], users: [], artists: [] });
  }

  const { q, type, kind } = parsed.data;

  try {
    if (type === "users") {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      let query = supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, is_admin")
        .limit(10);

      if (user) {
        query = query.or(`and(username.ilike.%${q}%,privacy.eq.public),and(username.ilike.%${q}%,id.eq.${user.id}),and(display_name.ilike.%${q}%,privacy.eq.public),and(display_name.ilike.%${q}%,id.eq.${user.id})`);
      } else {
        query = query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`).eq("privacy", "public");
      }

      const { data: users, error } = await query;

      if (error) {
        console.error("Supabase user search error:", error);
        return NextResponse.json({ error: "No pudimos buscar usuarios." }, { status: 502 });
      }

      const mapped = (users || []).map((u) => ({
        username: u.username,
        displayName: u.display_name,
        avatarUrl: u.avatar_url,
        isAdmin: u.is_admin || false,
      }));

      return NextResponse.json({ albums: [], users: mapped, artists: [] });
    }

    if (type === "artists") {
      const artists = await searchArtists(q);

      // Fetch artist images from Wikipedia
      const artistsWithImages = await Promise.all(
        artists.map(async (a) => {
          try {
            // Try exact name first
            let wikiRes = await fetch(
              `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(a.name)}`,
              { signal: AbortSignal.timeout(3000) }
            );

            // If not found, try search API
            if (!wikiRes.ok) {
              const searchRes = await fetch(
                `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(a.name + " musician")}&format=json&srlimit=1`,
                { signal: AbortSignal.timeout(3000) }
              );
              if (searchRes.ok) {
                const searchData = await searchRes.json();
                const title = searchData?.query?.search?.[0]?.title;
                if (title) {
                  wikiRes = await fetch(
                    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
                    { signal: AbortSignal.timeout(3000) }
                  );
                }
              }
            }

            if (!wikiRes.ok) return { ...a, imageUrl: null };
            const wikiData = await wikiRes.json();
            const thumb = wikiData?.thumbnail?.source || wikiData?.originalimage?.source || null;
            return { ...a, imageUrl: thumb };
          } catch {
            return { ...a, imageUrl: null };
          }
        })
      );

      return NextResponse.json({ albums: [], users: [], artists: artistsWithImages });
    }

    // Default: Search Albums via MusicBrainz API
    const mbAlbums = await searchAlbums(q, kind);
    const albums = mbAlbums.map((a) => ({
      mbid: a.id,
      entityType: a.entityType,
      approximate: a.approximate,
      title: a.title,
      artist: a.artist,
      year: a.year,
      coverUrl: a.coverUrl,
    }));
    return NextResponse.json({ albums, users: [], artists: [] });
  } catch (error) {
    console.error("Search API route error:", error);
    return NextResponse.json({ error: "No pudimos completar la búsqueda. Inténtalo de nuevo." }, { status: 502 });
  }
}

/**
 * POST endpoint for fetching an artist's discography
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = z.object({ artistId: z.string().uuid(), kind: z.enum(releaseKinds).default("album") }).safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "artistId is required" }, { status: 400 });
    }

    const releases = await getArtistReleases(parsed.data.artistId, parsed.data.kind);
    const albums = releases.map((a) => ({
      mbid: a.id,
      entityType: a.entityType,
      approximate: a.approximate,
      title: a.title,
      artist: a.artist,
      year: a.year,
      coverUrl: a.coverUrl,
    }));

    return NextResponse.json({ albums });
  } catch (error) {
    console.error("Artist discography fetch error:", error);
    return NextResponse.json({ error: "No pudimos cargar la discografía. Inténtalo de nuevo." }, { status: 502 });
  }
}
