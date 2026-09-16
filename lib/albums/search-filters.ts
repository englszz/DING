import type { SearchResultAlbum } from "@/types";
import { normalize } from "@/lib/musicbrainz/search";

export const editionLabels = {
  unspecified: "Sin variante indicada",
  deluxe: "Deluxe / ampliada",
  reissue: "Reedición / remaster",
} as const;
export type EditionKind = keyof typeof editionLabels;
export function editionKind(title: string, description = ""): EditionKind {
  const text = normalize(`${title} ${description}`);
  if (/\b(deluxe|expanded|bonus|extended|super deluxe)\b/.test(text)) return "deluxe";
  if (/\b(remaster(?:ed)?|reissue|anniversary|reedicion|remasterizado)\b/.test(text)) return "reissue";
  return "unspecified";
}
export type AlbumFilters = { artist: string; year: string; edition: string; sort: string; source: string };
export const defaultAlbumFilters: AlbumFilters = { artist: "", year: "", edition: "all", sort: "relevance", source: "all" };
export function filterAlbums(albums: SearchResultAlbum[], filters: AlbumFilters) {
  const result = albums.filter(album =>
    (filters.source === "all" || (filters.source === "itunes" ? album.entityType === "itunes" : album.entityType !== "itunes")) &&
    (!filters.artist || normalize(album.artist) === normalize(filters.artist)) &&
    (!filters.year || album.year?.slice(0, 4) === filters.year) &&
    (filters.edition === "all" || editionKind(album.title, album.editionDescription) === filters.edition)
  );
  if (filters.sort === "newest" || filters.sort === "oldest") {
    const direction = filters.sort === "newest" ? -1 : 1;
    result.sort((a, b) => {
      const ay = Number(a.year?.slice(0, 4)), by = Number(b.year?.slice(0, 4));
      if (!ay || !by) return Number(!ay) - Number(!by);
      return direction * (ay - by) || a.title.localeCompare(b.title);
    });
  } else if (filters.sort === "title") result.sort((a, b) => a.title.localeCompare(b.title));
  return result;
}
