import { itunesArtworkUrl } from "@/lib/images/itunes";
import {
  normalize,
  relevance,
  type ReleaseKind,
} from "@/lib/musicbrainz/search";
import type { SearchResultAlbum } from "@/types";
interface Item {
  artworkUrl100?:string;
  wrapperType?: string;
  kind?: string;
  collectionId?: number;
  artistId?: number;
  collectionName?: string;
  artistName?: string;
  trackName?: string;
  releaseDate?: string;
  trackCount?: number;
  trackNumber?: number;
  discNumber?: number;
  trackTimeMillis?: number;
}
const runtime = globalThis as typeof globalThis & {
  dingItunes?: {
    cache: Map<string, { expires: number; data: Item[] }>;
    pending: Map<string, Promise<Item[]>>;
    starts: number[];
  };
};
const state = (runtime.dingItunes ??= {
  cache: new Map(),
  pending: new Map(),
  starts: [],
});
async function request(
  path: string,
  params: Record<string, string>,
): Promise<Item[]> {
  const url = `https://itunes.apple.com/${path}?${new URLSearchParams({ ...params, country: "US", media: "music" })}`;
  const cached = state.cache.get(url);
  if (cached && cached.expires > Date.now()) return cached.data;
  const pending = state.pending.get(url);
  if (pending) return pending;
  state.starts = state.starts.filter((t) => Date.now() - t < 60000);
  if (state.starts.length >= 18 || state.pending.size >= 4)
    throw new Error(
      "El respaldo está ocupado. Inténtalo de nuevo en unos segundos.",
    );
  state.starts.push(Date.now());
  const work = (async () => {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 3600 },
    });
    if (!response.ok) throw new Error(`iTunes respondió ${response.status}`);
    const body = await response.json();
    if (!Array.isArray(body.results))
      throw new Error("Respuesta de iTunes inválida");
    const data = body.results as Item[];
    if (state.cache.size >= 250)
      state.cache.delete(state.cache.keys().next().value!);
    state.cache.set(url, { expires: Date.now() + 3600000, data });
    return data;
  })();
  state.pending.set(url, work);
  try {
    return await work;
  } finally {
    state.pending.delete(url);
  }
}
export function matchesItunesKind(title: string, kind: ReleaseKind): boolean {
  const text = normalize(title);
  const actual = /\bsingle$/.test(text)
    ? "single"
    : /\bep$/.test(text)
      ? "ep"
      : /\blive\b|\ben vivo\b|\ben directo\b/.test(text)
        ? "live"
        : /\bremix(?:es)?\b/.test(text)
          ? "remix"
          : /\bgreatest hits\b|\bbest of\b|\bcompilation\b/.test(text)
            ? "compilation"
            : "album";
  return kind === "all" || actual === kind;
}
function albums(items: Item[], kind: ReleaseKind): SearchResultAlbum[] {
  return [
    ...new Map(
      items
        .filter(
          (a) =>
            a.wrapperType === "collection" &&
            a.collectionId &&
            a.collectionName &&
            a.artistName &&
            matchesItunesKind(a.collectionName, kind),
        )
        .map((a) => [
          a.collectionId,
          {
            mbid: String(a.collectionId),
            entityType: "itunes" as const,
            title: a.collectionName!,
            artist: a.artistName!,
            year: a.releaseDate?.slice(0, 4),
            coverUrl:itunesArtworkUrl(a.artworkUrl100),
            artworkItunesId:String(a.collectionId),
          },
        ]),
    ).values(),
  ];
}
export async function searchItunesAlbums(
  query: string,
  kind: ReleaseKind = "album",
) {
  const term = normalize(query)
    .replace(/\b(?:de|by)\b/g, " ")
    .replace(/\bx100pre\b/g, "x 100pre")
    .trim();
  const result = albums(
    await request("search", { term, entity: "album", limit: "50" }),
    kind,
  );
  const words = term.split(/\s+/).filter(Boolean);
  return result
    .filter((a) => {
      const text = normalize(`${a.title} ${a.artist}`);
      return words.every((w) => text.includes(w));
    })
    .sort(
      (a, b) =>
        relevance(query, b.title, b.artist) -
        relevance(query, a.title, a.artist),
    );
}
export async function searchItunesArtists(query: string) {
  return (
    await request("search", { term: query, entity: "musicArtist", limit: "20" })
  )
    .filter((a) => a.wrapperType === "artist" && a.artistId && a.artistName)
    .map((a) => ({
      id: String(a.artistId),
      name: a.artistName!,
      source: "itunes" as const,
    }));
}
export async function itunesDiscography(id: string, kind: ReleaseKind) {
  return albums(
    await request("lookup", { id, entity: "album", limit: "200" }),
    kind,
  );
}
export async function itunesAlbum(id: string) {
  if (!/^\d{1,20}$/.test(id)) throw new Error("Referencia de iTunes inválida");
  const items = await request("lookup", { id, entity: "song", limit: "200" });
  const album = items.find(
    (a) => a.wrapperType === "collection" && String(a.collectionId) === id,
  );
  const tracks = items
    .filter((a) => a.kind === "song" && String(a.collectionId) === id)
    .sort(
      (a, b) =>
        (a.discNumber || 1) - (b.discNumber || 1) ||
        (a.trackNumber || 0) - (b.trackNumber || 0),
    );
  if (
    !album?.collectionName ||
    !album.artistName ||
    !tracks.length ||
    tracks.length !== album.trackCount
  )
    throw new Error(
      "El respaldo no devolvió el álbum completo. Inténtalo de nuevo.",
    );
  return {
    title: album.collectionName,
    coverUrl:itunesArtworkUrl(album.artworkUrl100),
    artist: album.artistName,
    year: album.releaseDate?.slice(0, 4),
    tracks: tracks.map((t, i) => ({
      position: i + 1,
      title: t.trackName || `Canción ${i + 1}`,
      durationMs: t.trackTimeMillis,
    })),
  };
}

export async function itunesArtworks(ids:string[]) {
 const valid=[...new Set(ids)].filter(id=>/^[0-9]{1,20}$/.test(id)).slice(0,20);
 if(!valid.length)return [];
 return (await request("lookup",{id:valid.join(","),entity:"album",limit:"200"})).filter(a=>a.wrapperType==="collection"&&valid.includes(String(a.collectionId))).flatMap(a=>{const url=itunesArtworkUrl(a.artworkUrl100);return url?[{id:String(a.collectionId),url}]:[];});
}
