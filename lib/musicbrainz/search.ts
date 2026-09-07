export const releaseKinds = ["album", "ep", "single", "all", "live", "compilation", "remix"] as const;
export type ReleaseKind = (typeof releaseKinds)[number];

export const releaseKindLabels: Record<ReleaseKind, string> = {
  album: "Álbumes", ep: "EP", single: "Singles", all: "Todos",
  live: "En directo", compilation: "Recopilaciones", remix: "Remixes",
};

export function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function quote(text: string): string {
  return `"${text.replace(/[\\"]/g, "\\$&")}"`;
}

export function kindQuery(kind: ReleaseKind): string {
  if (kind === "all") return "";
  if (["live", "compilation", "remix"].includes(kind)) return `secondarytype:${kind}`;
  const primary = `primarytype:${kind}`;
  return kind === "album"
    ? `${primary} AND NOT secondarytype:live AND NOT secondarytype:compilation AND NOT secondarytype:remix`
    : primary;
}

/** Each word may belong to the title or the artist, in either order. */
export function albumQuery(input: string, kind: ReleaseKind): string {
  const words = normalize(input).split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  const acrossFields = (tokens: string[]) => tokens.map(word =>
    `(releasegroup:${quote(word)} OR artist:${quote(word)})`).join(" AND ");
  // Preserve literal titles containing 'de'/'by', while allowing a connector.
  const withoutConnector = words.filter(word => !["de", "by"].includes(word));
  const clauses = [`releasegroup:${quote(input.trim())}^5`, acrossFields(words)];
  if (withoutConnector.length && withoutConnector.length !== words.length) {
    clauses.push(`(${acrossFields(withoutConnector)})`);
  }
  const filter = kindQuery(kind);
  return `(${clauses.map(clause => `(${clause})`).join(" OR ")}) AND status:official${filter ? ` AND (${filter})` : ""}`;
}

export function artistQuery(input: string): string {
  return `(artist:${quote(input.trim())}^5 OR alias:${quote(input.trim())} OR (${normalize(input).split(/\s+/).filter(Boolean).map(word => `artist:${quote(word)}`).join(" AND ")}))`;
}

export function matchesKind(primary: string | undefined, secondary: string[] = [], kind: ReleaseKind): boolean {
  if (kind === "all") return true;
  if (["live", "compilation", "remix"].includes(kind)) return secondary.some(type => type.toLowerCase() === kind);
  return primary?.toLowerCase() === kind && (kind !== "album" ||
    !secondary.some(type => ["live", "compilation", "remix"].includes(type.toLowerCase())));
}

export function relevance(input: string, title: string, artist: string, score = 0): number {
  const query = normalize(input);
  const name = normalize(title);
  const artistName = normalize(artist);
  const combined = new Set(`${name} ${artistName}`.split(" "));
  const words = query.split(" ").filter(word => !["de", "by"].includes(word));
  const coverage = words.filter(word => combined.has(word)).length / Math.max(words.length, 1);
  const exact = query === name || query === `${name} ${artistName}` || query === `${artistName} ${name}`;
  return (exact ? 1000 : 0) + coverage * 500 + Number(score);
}

/** Bounded recovery query: every word must still match a title, alias or artist. */
export function approximateAlbumQuery(input: string, kind: ReleaseKind): string {
  let normalized = normalize(input);
  // A spoken title is an equivalence, not a spelling correction. Keep it scoped.
  if (/\bbad bunny\b/.test(normalized) || /^(por siempre|porsiempre)$/.test(normalized)) {
    normalized = normalized.replace(/\bpor\s*siempre\b/g, "x 100pre");
  }
  const words = normalized.split(/\s+/).filter(word => word && !["de", "by"].includes(word));
  if (!words.length || words.length > 20) return "";
  const fields = (word: string, fuzzy = false) => {
    const term = fuzzy && word.length >= 4 ? `${word}~${word.length >= 8 ? 2 : 1}` : quote(word);
    return `(releasegroup:${term} OR alias:${term} OR artist:${term})`;
  };
  const clauses = words.map(word => {
    const alternatives = [fields(word, true)];
    // Recover one missing space, including letter/number boundaries (x100pre).
    if (word.length >= 4 && word.length <= 24) {
      for (let i = 1; i < word.length; i++) {
        if ((i >= 2 && word.length - i >= 2) || /[a-z]/i.test(word[i - 1]) && /[0-9]/.test(word[i])) {
          alternatives.push(`(${fields(word.slice(0, i))} AND ${fields(word.slice(i))})`);
        }
      }
    }
    return `(${alternatives.join(" OR ")})`;
  });
  const filter = kindQuery(kind);
  return `(${clauses.join(" AND ")}) AND status:official${filter ? ` AND (${filter})` : ""}`;
}
