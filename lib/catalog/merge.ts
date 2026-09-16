import type { SearchResultAlbum } from "@/types";
import { relevance } from "@/lib/musicbrainz/search";

/** Keep edition identities separate: never move ratings or tracks across catalogs. */
export function mergeCatalogAlbums(query: string, ...sources: SearchResultAlbum[][]): SearchResultAlbum[] {
  const unique = new Map<string, SearchResultAlbum>();
  for (const source of sources) for (const album of source) {
    const key = `${album.entityType || "release"}:${album.mbid}`;
    const previous = unique.get(key);
    unique.set(key, previous ? { ...previous, ...album, albumId: previous.albumId || album.albumId } : album);
  }
  return [...unique.values()].sort((a, b) =>
    relevance(query, b.title, b.artist) - relevance(query, a.title, a.artist) ||
    Number(b.entityType === "itunes") - Number(a.entityType === "itunes")
  );
}
