/** Keep optional portraits from passing unsupported sources to next/image. */
export function artistImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.port || url.username || url.password ||
      !["upload.wikimedia.org", "thumb.wikimedia.org"].includes(url.hostname) ||
      !url.pathname.startsWith("/wikipedia/")) return null;
    return url.href;
  } catch { return null; }
}

export function isMusicSummary(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const summary = value as {type?:string;description?:unknown};
  return summary.type !== "disambiguation" && typeof summary.description === "string" &&
    /\b(rapper|singer|songwriter|musician|band|duo|music|musical|composer|disc jockey|dj|record producer|recording artist)\b/i.test(summary.description);
}
