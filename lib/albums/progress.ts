export type AlbumProgress = {
  id: string;
  title: string;
  artist_name: string;
  cover_url: string | null;
  rated: number;
  total: number;
};

// Rows arrive newest first, so insertion order also preserves last activity.
export function groupAlbumProgress(
  rows: { track_id: string; album_id: string }[],
  completedAlbumIds: string[],
) {
  const completed = new Set(completedAlbumIds);
  const pending = new Map<string, Set<string>>();
  for (const row of rows) {
    if (completed.has(row.album_id)) continue;
    const tracks = pending.get(row.album_id) || new Set<string>();
    tracks.add(row.track_id);
    pending.set(row.album_id, tracks);
  }
  return pending;
}
