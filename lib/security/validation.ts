export function safeProfileUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  if (value.length > 2048) throw new Error("El enlace es demasiado largo.");
  const url = new URL(value.trim());
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("Usa un enlace http o https válido.");
  return url.href;
}
export function profileUrlForDisplay(value: unknown): string | undefined {
  try { return safeProfileUrl(value) || undefined; } catch { return undefined; }
}
export function escapeSearchTerm(value: string) {
  // Quoted PostgREST literal: punctuation cannot become filter syntax.
  return `"%${value.replace(/\\/g,"\\\\").replace(/"/g,'\\"').replace(/[%_]/g,'\\$&')}%"`;
}
