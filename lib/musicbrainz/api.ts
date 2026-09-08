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
  queue: Promise<void>; nextRequest: number; active?: number;
  cache: Map<string, { expires: number; data: unknown }>;
  pending: Map<string, Promise<unknown>>;
} };
const state = runtime.dingMusicBrainz ??= {
  queue: Promise.resolve(), nextRequest: 0, active: 0, cache: new Map(), pending: new Map(),
};
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class MusicServiceBusyError extends Error {
  constructor(message = "El servicio musical está ocupado. Inténtalo de nuevo en unos segundos.") { super(message); }
}

async function request<T>(path: string, params: Record<string, string> = {}, signal?: AbortSignal): Promise<T> {
  signal?.throwIfAborted();
  const url = MUSICBRAINZ_BASE + "/" + path + "?" + new URLSearchParams({ ...params, fmt: "json" });
  const cached = state.cache.get(url);
  if (cached && cached.expires > Date.now()) return cached.data as T;
  const pending = state.pending.get(url);
  if (pending) {
    try { return await pending as T; }
    catch (error) {
      signal?.throwIfAborted();
      // A previous viewer may have cancelled while this identical request waited.
      if (error instanceof Error && error.name === "AbortError") return request<T>(path, params, signal);
      throw error;
    }
  }
  if (state.pending.size >= 8) throw new MusicServiceBusyError();
  const started = Date.now();
  const work = (async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const queuedAt = Date.now();
      // Serialize starts, NOT entire responses/retries. Limit concurrent fetches.
      const slot = state.queue.then(async () => {
        while ((state.active || 0) >= 2 || Date.now() < state.nextRequest) {
          signal?.throwIfAborted();
          if (Date.now() - queuedAt > 7000) throw new MusicServiceBusyError();
          await sleep(50);
        }
        signal?.throwIfAborted();
        if (Date.now() - queuedAt > 7000) throw new MusicServiceBusyError();
        state.active = (state.active || 0) + 1;
        state.nextRequest = Date.now() + 1100;
      });
      state.queue = slot.then(() => undefined, () => undefined);
      await slot;
      let retryDelay = 0;
      try {
        const response = await fetch(url, {
          headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
          signal: AbortSignal.timeout(attempt === 0 ? 12000 : 8000), next: { revalidate: 3600 },
        });
        if ([429, 502, 503, 504].includes(response.status)) {
          if (attempt === 1) throw new MusicServiceBusyError();
          retryDelay = Math.min(5000, Math.max(1100, Number(response.headers.get("Retry-After")) * 1000 || 0));
          await response.body?.cancel();
        } else {
          if (!response.ok) throw new Error("MusicBrainz respondió " + response.status);
          const data: T = await response.json();
          if (state.cache.size >= 300) state.cache.delete(state.cache.keys().next().value!);
          state.cache.set(url, { data, expires: Date.now() + 3600000 });
          return data;
        }
      } catch (error) {
        if (attempt === 0 && (error instanceof TypeError || (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)))) retryDelay = 1100;
        else throw error;
      } finally {
        state.active = Math.max(0, (state.active || 1) - 1);
      }
      if (retryDelay) await sleep(retryDelay);
    }
    throw new MusicServiceBusyError();
  })();
  state.pending.set(url, work);
  try { return await work; }
  catch (error) {
    console.warn("musicbrainz_request_failed", { resource: path.split("/")[0], elapsedMs: Date.now() - started, pending: state.pending.size, reason: error instanceof Error ? error.name : "unknown" });
    throw error;
  } finally { state.pending.delete(url); }
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

export async function searchAlbums(query: string, kind: ReleaseKind = "album", signal?: AbortSignal): Promise<MusicBrainzRelease[]> {
  if (query.trim().length < 2) return [];
  const expression = albumQuery(query, kind);
  if (!expression) return [];
  let data = await request<{ "release-groups": Group[] }>("release-group", { query: expression, limit: "100" }, signal);
  let approximate = false;
  if (!(data["release-groups"] || []).some(group => matchesKind(group["primary-type"], group["secondary-types"], kind))) {
    const fallback = approximateAlbumQuery(query, kind);
    if (fallback) {
      data = await request<{ "release-groups": Group[] }>("release-group", { query: fallback, limit: "100" }, signal);
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

export async function searchArtists(query: string, signal?: AbortSignal): Promise<MusicBrainzArtist[]> {
  if (query.trim().length < 2 || !normalize(query)) return [];
  const data = await request<{ artists: MusicBrainzArtist[] }>("artist", { query: artistQuery(query), limit: "20" }, signal);
  return (data.artists || []).sort((a, b) =>
    Number(normalize(b.name) === normalize(query)) - Number(normalize(a.name) === normalize(query)) ||
    Number(b.score || 0) - Number(a.score || 0));
}

export async function getArtistReleases(artistId: string, kind: ReleaseKind = "album", signal?: AbortSignal): Promise<MusicBrainzRelease[]> {
  const groups: Group[] = [];
  let count = Infinity;
  while (groups.length < count) {
    const data = await request<{ "release-groups": Group[]; "release-group-count": number }>("release-group", {
      artist: artistId, inc: "artist-credits", limit: "100", offset: String(groups.length),
      "release-group-status": "website-default",
      ...(kind === "all" ? {} : { type: kind }),
    }, signal);
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
export async function getGroupEditions(groupId: string, signal?: AbortSignal): Promise<Release[]> {
  const releases: Release[] = [];
  let count = Infinity;
  while (releases.length < count) {
    const data = await request<{ releases: Release[]; "release-count": number }>("release", {
      "release-group": groupId, limit: "100", offset: String(releases.length),
    }, signal);
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

export async function getAlbumDetails(mbid: string, signal?: AbortSignal): Promise<MusicBrainzRelease | null> {
  const rel = await request<Release>(`release/${mbid}`, { inc: "recordings+artist-credits" }, signal);
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
