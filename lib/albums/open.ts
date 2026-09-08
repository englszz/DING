import type { SearchResultAlbum } from "@/types";

export async function openAlbum(
  album: Pick<SearchResultAlbum, "mbid" | "entityType"> &
    Partial<Pick<SearchResultAlbum, "albumId" | "title" | "artist" | "year">>,
): Promise<string> {
  if (album.albumId) return album.albumId;
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch("/api/album/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mbid: album.mbid,
        entityType: album.entityType || "release",
        title: album.title,
        artist: album.artist,
        year: album.year,
      }),
      signal: AbortSignal.timeout(60000),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.albumId) return data.albumId;
    if (
      attempt < (response.status === 409 ? 3 : 1) &&
      [409, 429, 502, 503, 504].includes(response.status)
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
      continue;
    }
    throw new Error(
      data.error || "No pudimos abrir el álbum. Inténtalo de nuevo.",
    );
  }
  throw new Error(
    "El álbum sigue preparándose. Inténtalo de nuevo en unos segundos.",
  );
}
