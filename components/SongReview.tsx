"use client";
import { useState } from "react";
import { saveSongReview, readSongDiscussion, addSongDiscussionComment } from "@/app/(app)/album/song-reviews";
export type PersonalSongReview = { id: string | null; content: string };
export function SongReview({ trackId, initialReview, editable, currentUserId, ownerLabel, databaseReady }: {
  trackId: string; initialReview?: PersonalSongReview; editable: boolean; currentUserId: string | null; ownerLabel: string; databaseReady: boolean;
}) {
  const [review, setReview] = useState(initialReview);
  const [draft, setDraft] = useState(initialReview?.content || "");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [comments, setComments] = useState<Awaited<ReturnType<typeof readSongDiscussion>>>([]);
  const [opened, setOpened] = useState(false);
  const [more, setMore] = useState(false);
  const [comment, setComment] = useState("");
  async function load(offset = 0) {
    if (!review?.id) return;
    setBusy(true); setError("");
    try { const rows = await readSongDiscussion(review.id, offset); setComments(prev => offset ? [...prev, ...rows] : rows); setMore(rows.length === 20); }
    catch { setError("No se pudo cargar la conversación. Vuelve a intentarlo."); }
    finally { setBusy(false); }
  }
  return <div className="w-full mt-3 text-sm">
    {review?.content && !editing && <div className="card-alt p-4"><p className="text-muted text-xs mb-2">{editable ? "Mi opinión" : `Opinión de ${ownerLabel}`}</p><p className="whitespace-pre-wrap break-words leading-relaxed">{review.content}</p></div>}
    {editable && !editing && <button className="text-teal text-xs mt-2" disabled={!databaseReady} onClick={() => { setDraft(review?.content || ""); setEditing(true); }}>{review?.content ? "Editar mi opinión" : "Escribir mi opinión"}</button>}
    {editable && !databaseReady && <p className="text-muted text-xs mt-2">Tus textos se conservan. La edición estará disponible al activar la actualización de reseñas.</p>}
    {editing && <form onSubmit={async event => { event.preventDefault(); setBusy(true); setError(""); try { setReview(await saveSongReview(trackId, draft)); setEditing(false); } catch { setError("No se pudo guardar. Tu texto sigue aquí para reintentarlo."); } finally { setBusy(false); } }}>
      <label className="block text-xs text-muted">Mi opinión<textarea className="form-input w-full mt-2" value={draft} maxLength={2000} rows={3} onChange={event => setDraft(event.target.value)} /></label>
      <div className="flex gap-3 mt-2"><button className="btn btn-primary text-xs" disabled={busy}>Guardar opinión</button><button type="button" className="btn btn-outline text-xs" disabled={busy} onClick={() => setEditing(false)}>Cancelar</button></div>
      <p className="text-muted text-xs mt-2">Para quitar tu opinión, guarda el campo vacío.</p>
    </form>}
    {review?.content && review.id && <details className="mt-3" onToggle={event => { if (event.currentTarget.open && !opened) { setOpened(true); void load(); } }}><summary className="text-muted text-xs cursor-pointer">Comentarios sobre esta opinión</summary>
      {comments.map(item => <div key={item.id} className="mt-3 border-l border-[var(--color-border)] pl-3"><p className="text-teal text-xs">@{item.username}</p><p className="whitespace-pre-wrap break-words">{item.content}</p></div>)}
      {busy && <p role="status">Cargando…</p>}
      {more && <button disabled={busy} onClick={() => void load(comments.length)}>Ver más</button>}
      {currentUserId && <form className="mt-3" onSubmit={async event => { event.preventDefault(); if (!review.id) return; setBusy(true); setError(""); try { await addSongDiscussionComment(review.id, comment); setComment(""); await load(); } catch { setError("No se pudo publicar. Inténtalo de nuevo."); } finally { setBusy(false); } }}><label className="text-xs">Añadir un comentario<textarea className="form-input w-full mt-1" value={comment} maxLength={2000} onChange={event => setComment(event.target.value)} /></label><button className="btn btn-outline text-xs mt-2" disabled={busy || !comment.trim()}>Comentar</button></form>}
      {error && <button onClick={() => void load()} disabled={busy}>Reintentar cargar conversación</button>}
    </details>}
    {error && <p role="alert" className="mt-2">{error}</p>}
  </div>;
}
