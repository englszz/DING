import type { SearchResultAlbum } from "@/types";
import {
  searchItunesAlbums,
  searchItunesArtists,
  itunesDiscography,
} from "@/lib/itunes/api";
import { withMusicFallback } from "@/lib/catalog/fallback";
import { localAlbums } from "@/lib/catalog/local";
import { normalize } from "@/lib/musicbrainz/search";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  searchAlbums,
  searchArtists,
  getArtistReleases,
} from "@/lib/musicbrainz/api";
import { createClient } from "@/lib/supabase/server";

import { releaseKinds } from "@/lib/musicbrainz/search";

const searchSchema = z.object({
  q: z.string().trim().min(2).max(200),
  type: z.enum(["albums", "users", "artists"]).default("albums"),
  kind: z.enum(releaseKinds).default("album"),
});

async function searchGet(request: Request) {
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
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let query = supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, is_admin")
        .limit(10);

      if (user) {
        query = query.or(
          `and(username.ilike.%${q}%,privacy.eq.public),and(username.ilike.%${q}%,id.eq.${user.id}),and(display_name.ilike.%${q}%,privacy.eq.public),and(display_name.ilike.%${q}%,id.eq.${user.id})`,
        );
      } else {
        query = query
          .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
          .eq("privacy", "public");
      }

      const { data: users, error } = await query;

      if (error) {
        console.error("Supabase user search error:", error);
        return NextResponse.json(
          { error: "No pudimos buscar usuarios." },
          { status: 502 },
        );
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
      const artists = await withMusicFallback(
        () =>
          searchArtists(
            q,
            AbortSignal.any([request.signal, AbortSignal.timeout(25000)]),
          ),
        () => searchItunesArtists(q),
      );

      return NextResponse.json({ albums: [], users: [], artists });
    }

    const local = await localAlbums(q, kind);
    const qualified = local.filter((a) =>
      [
        normalize(a.title + " " + a.artist),
        normalize(a.artist + " " + a.title),
      ].includes(normalize(q)),
    );
    if (qualified.length)
      return NextResponse.json({ albums: qualified, users: [], artists: [] });
    const albums = await withMusicFallback<SearchResultAlbum[]>(
      async () => {
        const results = await searchAlbums(
          q,
          kind,
          AbortSignal.any([request.signal, AbortSignal.timeout(25000)]),
        );
        return results.map((a) => ({
          mbid: a.id,
          entityType: a.entityType,
          approximate: a.approximate,
          title: a.title,
          artist: a.artist,
          year: a.year,
          coverUrl: a.coverUrl,
        }));
      },
      async () => {
        try {
          const backup = await searchItunesAlbums(q, kind);
          return backup.length ? backup : local;
        } catch (error) {
          if (local.length) return local;
          throw error;
        }
      },
    );
    return NextResponse.json({ albums, users: [], artists: [] });
  } catch (error) {
    console.error("Search API route error:", error);
    return NextResponse.json(
      { error: "No pudimos completar la búsqueda. Inténtalo de nuevo." },
      { status: 502 },
    );
  }
}

/**
 * POST endpoint for fetching an artist's discography
 */
async function searchPost(request: Request) {
  try {
    const body = await request.json();
    const parsed = z
      .object({
        artistId: z.string().min(1).max(50),
        source: z.enum(["musicbrainz", "itunes"]).default("musicbrainz"),
        artistName: z.string().max(200).optional(),
        kind: z.enum(releaseKinds).default("album"),
      })
      .safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "artistId is required" },
        { status: 400 },
      );
    }

    const { artistId, source, artistName, kind } = parsed.data;
    if (
      (source === "itunes" && !/^[0-9]{1,20}$/.test(artistId)) ||
      (source === "musicbrainz" &&
        !z.string().uuid().safeParse(artistId).success)
    )
      return NextResponse.json(
        { error: "Referencia de artista inválida" },
        { status: 400 },
      );
    const backup = async () => {
      if (source === "itunes") return itunesDiscography(artistId, kind);
      if (!artistName)
        throw new Error("Falta el nombre del artista para el respaldo");
      const matches = (await searchItunesArtists(artistName)).filter(
        (a) => normalize(a.name) === normalize(artistName),
      );
      if (matches.length !== 1)
        throw new Error(
          "No pudimos identificar al artista con seguridad en el respaldo",
        );
      return itunesDiscography(matches[0].id, kind);
    };
    const albums =
      source === "itunes"
        ? await backup()
        : await withMusicFallback<SearchResultAlbum[]>(async () => {
            const releases = await getArtistReleases(
              artistId,
              kind,
              AbortSignal.any([request.signal, AbortSignal.timeout(40000)]),
            );
            return releases.map((a) => ({
              mbid: a.id,
              entityType: a.entityType,
              title: a.title,
              artist: a.artist,
              year: a.year,
              coverUrl: a.coverUrl,
            }));
          }, backup);
    return NextResponse.json({ albums });
  } catch (error) {
    console.error("Artist discography fetch error:", error);
    return NextResponse.json(
      { error: "No pudimos cargar la discografía. Inténtalo de nuevo." },
      { status: 502 },
    );
  }
}

async function timed(
  request: Request,
  handler: (request: Request) => Promise<NextResponse>,
  operation: string,
) {
  const started = Date.now();
  const response = await handler(request);
  const duration = Date.now() - started;
  response.headers.set("Server-Timing", `search;dur=${duration}`);
  console.info("music_search", {
    operation,
    durationMs: duration,
    status: response.status,
  });
  return response;
}
export async function GET(request: Request) {
  return timed(request, searchGet, "search");
}
export async function POST(request: Request) {
  return timed(request, searchPost, "discography");
}
