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
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState("");
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
      setEditing(false);
      setConfirmDelete(false);
      setNotice(content.trim() ? "Comentario guardado." : "Comentario eliminado.");
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
          {data?.signedIn && (!data.own || editing) && (
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
                disabled={busy || !draft.trim() || draft.trim() === data.own}
                onClick={() => save(draft)}
              >
                {busy ? "Guardando…" : data.own ? "Guardar cambios" : "Publicar comentario"}
              </button>
              {editing && <button className="btn text-xs ml-3" disabled={busy} onClick={() => { setDraft(data.own); setEditing(false); setError(""); }}>Cancelar</button>}
            </div>
          )}
          {data?.own && !editing && (
            <div className="border-t border-[var(--color-border)] pt-3">
              <details>
                <summary className="text-xs text-muted cursor-pointer">Opciones de mi comentario</summary>
                <div className="flex flex-wrap gap-3 mt-3">
                  <button className="btn btn-outline text-xs" disabled={busy} onClick={() => { setDraft(data.own); setEditing(true); setConfirmDelete(false); setNotice(""); }}>Editar comentario</button>
                  <button className="btn text-xs" disabled={busy} onClick={() => setConfirmDelete(true)}>Eliminar comentario</button>
                </div>
              </details>
              {confirmDelete && <div className="card-alt p-3 mt-3">
                <p className="text-sm mb-3">¿Eliminar tu comentario de esta canción?</p>
                <button className="btn btn-outline text-xs" disabled={busy} onClick={() => save("")}>Sí, eliminar</button>
                <button className="btn text-xs ml-3" disabled={busy} onClick={() => setConfirmDelete(false)}>Cancelar</button>
              </div>}
            </div>
          )}
          {notice && <p role="status" className="text-teal text-xs">{notice}</p>}
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
