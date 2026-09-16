// Cover Art Archive metadata can contain scans, backs and booklets. Only use
// approved fronts of the exact release requested, never a similar album title.
export function archiveImageUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.port || url.username || url.password) return;
    if (!(url.hostname === "archive.org" || /^(?:ia[0-9]+\.)?(?:us|eu)\.archive\.org$/.test(url.hostname)) || !url.pathname.startsWith("/download/mbid-")) return;
    url.protocol = "https:";
    return url.href;
  } catch { return; }
}
export function approvedFronts(data: unknown): string[] {
  if (!data || typeof data !== "object" || !("images" in data) || !Array.isArray(data.images)) return [];
  return [...new Set(data.images.flatMap(image => {
    if (!image || image.front !== true || image.approved !== true) return [];
    const url = archiveImageUrl(image.thumbnails?.["500"]) || archiveImageUrl(image.thumbnails?.large);
    return url ? [url] : [];
  }))].slice(0, 3);
}
