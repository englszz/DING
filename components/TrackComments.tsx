"use client";
import { useState } from "react";
import {
  readTrackComments,
  writeTrackComment,
} from "@/app/(app)/album/track-comments";
export function TrackComments({ trackId }: { trackId: string }) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [draft, setDraft] = useState("");
  const [data, setData] = useState<Awaited<
    ReturnType<typeof readTrackComments>
  > | null>(null);
  const [more, setMore] = useState(false);
  async function load(append = false) {
    setBusy(true);
    setError("");
    try {
      const result = await readTrackComments(
        trackId,
        append ? data?.items.length || 0 : 0,
      );
      setMore(result.items.length === 20);
      setData((prev) => ({
        ...result,
        items: append
          ? [...(prev?.items || []), ...result.items]
          : result.items,
      }));
      if (!append) setDraft(result.own);
    } catch {
      setError("No se pudieron cargar los comentarios.");
    } finally {
      setBusy(false);
    }
  }
  async function save(content: string) {
    setBusy(true);
    setError("");
    try {
      await writeTrackComment(trackId, content);
      await load();
    } catch {
      setError("No se guardó el comentario. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="w-full pt-3">
      <button
        type="button"
        className="inline-flex items-center gap-2 text-muted text-xs hover:text-teal"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          if (!open && !data) void load();
        }}
      >
        Comentarios
        <svg
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          className={`transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        >
          <path d="m3 6 5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="mt-4 space-y-4 text-sm">
          {data?.items.map((item) => (
            <div key={item.id}>
              <p className="text-teal text-xs">@{item.username}</p>
              <p className="whitespace-pre-wrap break-words mt-1">
                {item.content}
              </p>
            </div>
          ))}
          {data?.items.length === 0 && (
            <p className="text-muted">Todavía no hay comentarios.</p>
          )}
          {more && (
            <button disabled={busy} onClick={() => load(true)}>
              Ver más
            </button>
          )}
          {data?.signedIn && (
            <div className="space-y-3">
              <textarea
                aria-label="Tu comentario sobre la canción"
                className="form-input"
                rows={2}
                maxLength={2000}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="¿Qué opinas de esta canción?"
              />
              <p className="text-muted text-xs">
                Visible según la privacidad de tu perfil.
              </p>
              <button
                className="btn btn-outline text-xs"
                disabled={busy || !draft.trim()}
                onClick={() => save(draft)}
              >
                Guardar comentario
              </button>
              {data.own && (
                <button
                  className="btn text-xs ml-3"
                  disabled={busy}
                  onClick={() => save("")}
                >
                  Eliminar
                </button>
              )}
            </div>
          )}
          {busy && <p role="status">Cargando…</p>}
          {error && (
            <p role="alert">
              {error} <button onClick={() => load()}>Reintentar</button>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
