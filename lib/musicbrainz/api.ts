const MUSICBRAINZ_BASE = "https://musicbrainz.org/ws/2";
const USER_AGENT = process.env.MUSICBRAINZ_USER_AGENT || "DING/1.0 (https://ding.app)";

export interface MusicBrainzRelease {
  id: string;
  title: string;
  artist: string;
  year?: string;
  coverUrl?: string;
  tracks?: Array<{
    position: number;
    title: string;
    durationMs?: number;
  }>;
}

export interface MusicBrainzArtist {
  id: string;
  name: string;
  type?: string;
  country?: string;
  disambiguation?: string;
  score?: number;
}

/**
 * Search MusicBrainz for albums. 
 * Prioritizes album-type releases over singles/EPs.
 */
export async function searchAlbums(query: string): Promise<MusicBrainzRelease[]> {
  if (!query || query.trim().length < 2) return [];

  try {
    const encodedQuery = encodeURIComponent(query.trim());
    const res = await fetch(
      `${MUSICBRAINZ_BASE}/release?query=${encodedQuery}&fmt=json&limit=20`,
      {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
        },
        next: { revalidate: 3600 },
      }
    );

    if (!res.ok) return [];

    const data = await res.json();
    const releases = data.releases || [];

    const parsed = releases
      .filter((rel: any) => rel.date)
      .map((rel: any) => {
        const artistCredit = rel["artist-credit"] || [];
        const artistName =
          artistCredit.map((a: any) => a.name || a.artist?.name).join(", ") ||
          "Artista Desconocido";
        const year = rel.date ? rel.date.substring(0, 4) : undefined;
        const primaryType = rel["release-group"]?.["primary-type"] || "";
        const isAlbum = primaryType === "Album";

        return {
          id: rel.id,
          title: rel.title,
          artist: artistName,
          year,
          coverUrl: `https://coverartarchive.org/release/${rel.id}/front-250`,
          _score: rel.score || 0,
          _isAlbum: isAlbum,
        };
      });

    // Sort: albums first, then by score
    parsed.sort((a: (typeof parsed)[0], b: (typeof parsed)[0]) => {
      if (a._isAlbum && !b._isAlbum) return -1;
      if (!a._isAlbum && b._isAlbum) return 1;
      return b._score - a._score;
    });

    return parsed.map(({ _score, _isAlbum, ...rest }: (typeof parsed)[0]) => rest);
  } catch (error) {
    console.error("MusicBrainz album search error:", error);
    return [];
  }
}

/**
 * Search MusicBrainz for artists matching the query
 */
export async function searchArtists(query: string): Promise<MusicBrainzArtist[]> {
  if (!query || query.trim().length < 2) return [];

  try {
    const encodedQuery = encodeURIComponent(query.trim());
    const res = await fetch(
      `${MUSICBRAINZ_BASE}/artist?query=${encodedQuery}&fmt=json&limit=10`,
      {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
        },
        next: { revalidate: 3600 },
      }
    );

    if (!res.ok) return [];

    const data = await res.json();
    return (data.artists || []).map((a: any) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      country: a.country,
      disambiguation: a["disambiguation"],
      score: a.score,
    }));
  } catch (error) {
    console.error("MusicBrainz artist search error:", error);
    return [];
  }
}

/**
 * Fetches discography for a MusicBrainz artist.
 * Uses the `artist` query parameter to get releases where this artist is credited.
 */
export async function getArtistReleases(artistId: string): Promise<MusicBrainzRelease[]> {
  if (!artistId) return [];

  try {
    const res = await fetch(
      `${MUSICBRAINZ_BASE}/release?artist=${artistId}&fmt=json&limit=100&status=official`,
      {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
        },
        next: { revalidate: 3600 },
      }
    );

    if (!res.ok) return [];

    const data = await res.json();
    const releases = data.releases || [];

    // Deduplicate by release-group (keep first)
    const seen = new Set<string>();

    return releases
      .filter((rel: any) => {
        const groupId = rel["release-group"]?.id || rel.id;
        if (seen.has(groupId)) return false;
        seen.add(groupId);
        return rel.date;
      })
      .map((rel: any) => {
        const artistCredit = rel["artist-credit"] || [];
        const artistName =
          artistCredit.map((a: any) => a.name || a.artist?.name).join(", ") ||
          "Artista Desconocido";
        const year = rel.date ? rel.date.substring(0, 4) : undefined;

        return {
          id: rel.id,
          title: rel.title,
          artist: artistName,
          year,
          coverUrl: `https://coverartarchive.org/release/${rel.id}/front-250`,
        };
      });
  } catch (error) {
    console.error("MusicBrainz getArtistReleases error:", error);
    return [];
  }
}

/**
 * Checks if cover art exists for a release MBID
 */
async function checkCoverArt(releaseId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://coverartarchive.org/release/${releaseId}/front-250`,
      {
        method: "HEAD",
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(3000),
      }
    );
    return res.ok ? `https://coverartarchive.org/release/${releaseId}/front-250` : null;
  } catch {
    return null;
  }
}

/**
 * Fetches full album details including tracklist by MusicBrainz ID (MBID)
 */
export async function getAlbumDetails(mbid: string): Promise<MusicBrainzRelease | null> {
  if (!mbid) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(
      `${MUSICBRAINZ_BASE}/release/${mbid}?inc=recordings+artist-credits&fmt=json`,
      {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!res.ok) return null;

    const rel = await res.json();
    const artistCredit = rel["artist-credit"] || [];
    const artistName =
      artistCredit.map((a: any) => a.name || a.artist?.name).join(", ") ||
      "Artista Desconocido";
    const year = rel.date ? rel.date.substring(0, 4) : undefined;

    const media = rel.media || [];
    const tracks: Array<{ position: number; title: string; durationMs?: number }> = [];

    media.forEach((medium: any) => {
      const mediaTracks = medium.tracks || [];
      mediaTracks.forEach((t: any) => {
        tracks.push({
          position: t.position || tracks.length + 1,
          title: t.title || t.recording?.title || `Track ${tracks.length + 1}`,
          durationMs: t.length || t.recording?.length,
        });
      });
    });

    // Check cover art availability
    const coverUrl = await checkCoverArt(rel.id);

    return {
      id: rel.id,
      title: rel.title,
      artist: artistName,
      year,
      coverUrl: coverUrl || undefined,
      tracks,
    };
  } catch (error) {
    console.error("MusicBrainz getAlbumDetails error:", error);
    return null;
  }
}
