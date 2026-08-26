// ─── Music ─────────────────────────────────────────────────────────────────

export interface Album {
  id: string;
  external_id: string; // MBID
  title: string;
  artist_name: string;
  artist_external_id?: string;
  cover_url?: string;
  release_date?: string;
  created_at: string;
  updated_at: string;
}

export interface Track {
  id: string;
  album_id: string;
  external_id?: string;
  title: string;
  track_number: number;
  duration_ms?: number;
  created_at: string;
}

// ─── Users ──────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  privacy: "public" | "private";
  is_admin?: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Ratings & Logs ─────────────────────────────────────────────────────────

export interface AlbumRating {
  id: string;
  user_id: string;
  album_id: string;
  rating: number; // 0.0 – 10.0
  review?: string;
  created_at: string;
  updated_at: string;
}

export interface ListenLog {
  id: string;
  user_id: string;
  album_id: string;
  listened_at: string;
  created_at: string;
}

export interface TrackReview {
  id: string;
  album_review_id: string;
  track_id: string;
  rating: number;
  comment?: string;
  created_at: string;
}

// ─── MusicBrainz API shapes ──────────────────────────────────────────────────

export interface MBRelease {
  id: string; // MBID
  title: string;
  date?: string;
  "artist-credit"?: Array<{
    artist: { id: string; name: string };
    name: string;
  }>;
  "release-group"?: { id: string };
  media?: Array<{
    tracks: Array<{
      id: string;
      number: string;
      title: string;
      position: number;
      length?: number; // ms
    }>;
  }>;
}

export interface MBSearchResult {
  releases: MBRelease[];
  count: number;
  offset: number;
}

// ─── Search ─────────────────────────────────────────────────────────────────

export interface SearchResultAlbum {
  mbid: string;
  title: string;
  artist: string;
  year?: string;
  coverUrl?: string;
}

export interface SearchResultUser {
  username: string;
  displayName?: string;
  avatarUrl?: string;
  isAdmin?: boolean;
}

export interface SearchResults {
  albums: SearchResultAlbum[];
  users: SearchResultUser[];
}
