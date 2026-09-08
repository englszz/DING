import { createClient } from "@/lib/supabase/server";
import {
  normalize,
  relevance,
  type ReleaseKind,
} from "@/lib/musicbrainz/search";
import { matchesItunesKind } from "@/lib/itunes/api";
import type { SearchResultAlbum } from "@/types";
export async function localAlbums(
  query: string,
  kind: ReleaseKind,
): Promise<SearchResultAlbum[]> {
  const words = normalize(query)
    .split(/\s+/)
    .filter((w) => w && !["de", "by"].includes(w))
    .slice(0, 8);
  if (!words.length) return [];
  try {
    const db = await createClient();
    let builder = db
      .from("albums")
      .select("id,external_id,title,artist_name,release_date,cover_url,artwork_itunes_id")
      .limit(50)
      .abortSignal(AbortSignal.timeout(1200));
    for (const word of words)
      builder = builder.or(`title.ilike.%${word}%,artist_name.ilike.%${word}%`);
    const { data, error } = await builder;
    if (error) return [];
    return (data || [])
      .filter((a) => matchesItunesKind(a.title, kind))
      .map((a) => ({
        mbid: a.external_id.startsWith("itunes:")
          ? a.external_id.slice(7)
          : a.external_id,
        entityType: a.external_id.startsWith("itunes:")
          ? ("itunes" as const)
          : ("release" as const),
        albumId: a.id,
        title: a.title,
        artist: a.artist_name,
        year: a.release_date || undefined,
        coverUrl: a.cover_url || undefined,
        artworkItunesId:a.artwork_itunes_id||undefined,
      }))
      .sort(
        (a, b) =>
          relevance(query, b.title, b.artist) -
          relevance(query, a.title, a.artist),
      );
  } catch {
    return [];
  }
}
