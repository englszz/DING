import { approximateAlbumQuery, albumQuery, artistQuery, matchesKind, normalize, relevance, type ReleaseKind } from "./search";

const MUSICBRAINZ_BASE = "https://musicbrainz.org/ws/2";
const USER_AGENT = process.env.MUSICBRAINZ_USER_AGENT || "DING/1.0 (https://ding.app)";

export interface MusicBrainzRelease {
  id: string;
  entityType?: "release" | "release-group";
  approximate?: boolean;
  title: string;
  artist: string;
  year?: string;
  coverUrl?: string;
  tracks?: Array<{ position: number; title: string; durationMs?: number }>;
}
export interface MusicBrainzArtist {
  id: string; name: string; type?: string; country?: string;
  disambiguation?: string; score?: number;
}
interface Credit { name?: string; joinphrase?: string; artist?: { id: string; name: string } }
interface Group {
  id: string; title: string; score?: number;
  count?: number;
  tags?: Array<{ count: number; name: string }>;
  "first-release-date"?: string;
  "primary-type"?: string;
  "secondary-types"?: string[];
  "artist-credit"?: Credit[];
}
interface Release {
  id: string; title: string; date?: string; status?: string; country?: string;
  disambiguation?: string;
  "artist-credit"?: Credit[];
  "cover-art-archive"?: { front?: boolean };
  media?: Array<{ tracks?: Array<{ position?: number; title?: string; length?: number; recording?: { title?: string; length?: number } }> }>;
}

// Share a queue across route modules in this server process. A distributed
// deployment should use a shared limiter for all instances using the same IP.
const runtime = globalThis as typeof globalThis & { dingMusicBrainz?: {
  queue: Promise<void>; nextRequest: number;
  cache: Map<string, { expires: number; data: unknown }>;
  pending: Map<string, Promise<unknown>>;
} };
const state = runtime.dingMusicBrainz ??= {
  queue: Promise.resolve(), nextRequest: 0, cache: new Map(), pending: new Map(),
};
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function request<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = `${MUSICBRAINZ_BASE}/${path}?${new URLSearchParams({ ...params, fmt: "json" })}`;
  const cached = state.cache.get(url);
  if (cached && cached.expires > Date.now()) return cached.data as T;
  const pending = state.pending.get(url);
  if (pending) return pending as Promise<T>;
  const work = state.queue.then(async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      await sleep(Math.max(0, state.nextRequest - Date.now()));
      state.nextRequest = Date.now() + 1100;
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(15000), next: { revalidate: 3600 },
      });
      if ((response.status === 429 || response.status === 503) && attempt < 2) {
        const retry = Number(response.headers.get("Retry-After"));
        state.nextRequest = Date.now() + Math.min(10000, Math.max(2000 * (attempt + 1), (retry || 0) * 1000));
        continue;
      }
      if (!response.ok) throw new Error(`MusicBrainz respondió ${response.status}`);
      const data: T = await response.json();
      if (state.cache.size >= 300) state.cache.delete(state.cache.keys().next().value!);
      state.cache.set(url, { data, expires: Date.now() + 3600000 });
      return data;
    }
    throw new Error("MusicBrainz no está disponible");
  });
  state.queue = work.then(() => undefined, () => undefined);
  state.pending.set(url, work);
  try { return await work; } finally { state.pending.delete(url); }
}

function artistName(credits: Credit[] = []): string {
  return credits.map(credit => `${credit.name || credit.artist?.name || ""}${credit.joinphrase || ""}`).join("") || "Artista desconocido";
}
function mapGroup(group: Group): MusicBrainzRelease {
  return { id: group.id, entityType: "release-group", title: group.title,
    artist: artistName(group["artist-credit"]),
    year: group["first-release-date"]?.slice(0, 4) || undefined,
    coverUrl: `https://coverartarchive.org/release-group/${group.id}/front-250` };
}

export async function searchAlbums(query: string, kind: ReleaseKind = "album"): Promise<MusicBrainzRelease[]> {
  if (query.trim().length < 2) return [];
  const expression = albumQuery(query, kind);
  if (!expression) return [];
  let data = await request<{ "release-groups": Group[] }>("release-group", { query: expression, limit: "100" });
  let approximate = false;
  if (!(data["release-groups"] || []).some(group => matchesKind(group["primary-type"], group["secondary-types"], kind))) {
    const fallback = approximateAlbumQuery(query, kind);
    if (fallback) {
      data = await request<{ "release-groups": Group[] }>("release-group", { query: fallback, limit: "100" });
      approximate = true;
    }
  }
  // Documentation is a weak tie-breaker, not a streaming popularity metric.
  // It cannot outweigh an exact title/artist match or missing query words.
  const textRank = (group: Group) => relevance(query, group.title, artistName(group["artist-credit"]));
  const rank = (group: Group) => Number(group.score || 0) * 0.2 +
    Math.min(72, Math.log2(1 + Math.max(0, group.count || 0)) * 12) +
    Math.min(18, (group.tags || []).reduce((sum, tag) => sum + Math.max(0, tag.count), 0));
  return [...new Map((data["release-groups"] || []).map(group => [group.id, group])).values()]
    .filter(group => matchesKind(group["primary-type"], group["secondary-types"], kind))
    .sort((a, b) => textRank(b) - textRank(a) || rank(b) - rank(a) || a.id.localeCompare(b.id))
    .filter(group => !approximate || Number(group.score || 0) >= 80)
    .map(group => ({ ...mapGroup(group), approximate }));
}

export async function searchArtists(query: string): Promise<MusicBrainzArtist[]> {
  if (query.trim().length < 2 || !normalize(query)) return [];
  const data = await request<{ artists: MusicBrainzArtist[] }>("artist", { query: artistQuery(query), limit: "20" });
  return (data.artists || []).sort((a, b) =>
    Number(normalize(b.name) === normalize(query)) - Number(normalize(a.name) === normalize(query)) ||
    Number(b.score || 0) - Number(a.score || 0));
}

export async function getArtistReleases(artistId: string, kind: ReleaseKind = "album"): Promise<MusicBrainzRelease[]> {
  const groups: Group[] = [];
  let count = Infinity;
  while (groups.length < count) {
    const data = await request<{ "release-groups": Group[]; "release-group-count": number }>("release-group", {
      artist: artistId, inc: "artist-credits", limit: "100", offset: String(groups.length),
      "release-group-status": "website-default",
      ...(kind === "all" ? {} : { type: kind }),
    });
    const page = data["release-groups"] || [];
    if (!page.length) break;
    groups.push(...page);
    count = data["release-group-count"];
  }
  return [...new Map(groups.map(group => [group.id, group])).values()]
    .filter(group => matchesKind(group["primary-type"], group["secondary-types"], kind))
    .sort((a, b) => (b["first-release-date"] || "").localeCompare(a["first-release-date"] || "") || a.title.localeCompare(b.title))
    .map(mapGroup);
}

/** Includes every edition so legacy saved releases can be reused unchanged. */
export async function getGroupEditions(groupId: string): Promise<Release[]> {
  const releases: Release[] = [];
  let count = Infinity;
  while (releases.length < count) {
    const data = await request<{ releases: Release[]; "release-count": number }>("release", {
      "release-group": groupId, limit: "100", offset: String(releases.length),
    });
    if (!data.releases?.length) break;
    releases.push(...data.releases);
    count = data["release-count"];
  }
  const rank = (release: Release) =>
    (release.status === "Official" ? 100 : 0) +
    (!/deluxe|remaster|anniversary|bonus/i.test(`${release.title} ${release.disambiguation || ""}`) ? 20 : 0) +
    (release["cover-art-archive"]?.front ? 10 : 0) + (release.country === "XW" ? 5 : 0);
  return releases.sort((a, b) => rank(b) - rank(a) || (a.date || "9999").localeCompare(b.date || "9999") || a.id.localeCompare(b.id));
}

export async function getAlbumDetails(mbid: string): Promise<MusicBrainzRelease | null> {
  const rel = await request<Release>(`release/${mbid}`, { inc: "recordings+artist-credits" });
  const tracks: NonNullable<MusicBrainzRelease["tracks"]> = [];
  for (const medium of rel.media || []) {
    for (const track of medium.tracks || []) {
      tracks.push({ position: tracks.length + 1,
        title: track.title || track.recording?.title || `Track ${tracks.length + 1}`,
        durationMs: track.length || track.recording?.length });
    }
  }
  return { id: rel.id, entityType: "release", title: rel.title,
    artist: artistName(rel["artist-credit"]), year: rel.date?.slice(0, 4), tracks,
    coverUrl: rel["cover-art-archive"]?.front ? `https://coverartarchive.org/release/${rel.id}/front-500` : undefined };
}
