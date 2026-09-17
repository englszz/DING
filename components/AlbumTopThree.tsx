"use client";

import { useEffect, useState } from "react";

import { saveAlbumTopThree } from "@/app/(app)/album/song-reviews";

type Track = { id: string; title: string };

export function AlbumTopThree({ albumId, userId, tracks, initialTrackIds = [], editable = true, ownerLabel = "", databaseReady = true }: {
  albumId: string;
  userId: string;
  tracks: Track[];
  initialTrackIds?: string[];
  editable?: boolean;
  ownerLabel?: string;
  databaseReady?: boolean;
}) {
  const storageKey = `ding:top-three:${userId}:${albumId}`;
  const [saved, setSaved] = useState<string[]>(initialTrackIds);
  const [draft, setDraft] = useState<string[]>(["", "", ""]);
  const [editing, setEditing] = useState(false);
  const [ready, setReady] = useState(!editable || initialTrackIds.length === 3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const initialKey = initialTrackIds.join(":");
  const tracksKey = tracks.map(track => track.id).join(":");
  useEffect(() => {
    if (!editable) return;
    if (initialKey) {
      const timer = window.setTimeout(() => { setSaved(initialKey.split(":")); setReady(true); setBusy(false); }, 0);
      return () => window.clearTimeout(timer);
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const value: unknown = JSON.parse(localStorage.getItem(storageKey) || "[]");
        if (Array.isArray(value) && value.length === 3 && new Set(value).size === 3 && value.every(id => tracksKey.split(":").includes(id))) {
          setSaved(value); setDraft(value);
          if (databaseReady) {
            setBusy(true);
            const canonical = await saveAlbumTopThree(albumId, value, true);
            if (active) { setSaved(canonical); setDraft(canonical); setMessage("Tu top 3 está guardado en tu cuenta."); }
          }
        }
      } catch { if (active) setError("No se pudo sincronizar tu top 3. La copia local se conserva; puedes reintentar con Editar mi top 3."); }
      finally { if (active) { setReady(true); setBusy(false); } }
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [storageKey, tracksKey, editable, initialKey, databaseReady, albumId]);

  async function save() {
    if (draft.some(id => !tracks.some(track => track.id === id)) || new Set(draft).size !== 3) return;
    setBusy(true); setError("");
    try { localStorage.setItem(`${storageKey}:draft`, JSON.stringify(draft)); } catch { /* Server save can still succeed. */ }
    try {
      const canonical = await saveAlbumTopThree(albumId, draft);
      setSaved(canonical); setEditing(false); setMessage("Tu top 3 está guardado en tu cuenta.");
      try { localStorage.setItem(storageKey, JSON.stringify(canonical)); localStorage.removeItem(`${storageKey}:draft`); } catch { /* Account copy is already saved. */ }
    } catch { setError("No se pudo guardar en tu cuenta. Tu selección se conserva para reintentarlo."); }
    finally { setBusy(false); }
  }

  return (
    <section className="card p-5 sm:p-6 mb-8" aria-labelledby="top-three-title">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-2">
        <h2 id="top-three-title" className="font-display text-teal text-xl">{editable ? "Mi top 3 del álbum" : `Top 3 de ${ownerLabel}`}</h2>
        {editable && databaseReady && !editing && ready && tracks.length >= 3 && (
          <button className="btn btn-outline text-xs" onClick={() => {
            try {
              const recovery = JSON.parse(localStorage.getItem(`${storageKey}:draft`) || "null");
              setDraft(Array.isArray(recovery) && recovery.length === 3 && recovery.every(id => tracks.some(t => t.id === id)) ? recovery : saved.length ? [...saved] : ["", "", ""]);
            } catch { setDraft(saved.length ? [...saved] : ["", "", ""]); }
            setEditing(true);
            setMessage("");
          }}>{saved.length ? "Editar mi top 3" : "Elegir mis canciones"}</button>
        )}
      </div>
      <p className="text-muted text-sm mb-5">Tres favoritas elegidas personalmente, independientes de las notas.</p>
      {!ready ? <p role="status">Cargando tu selección…</p> : tracks.length < 3 ? (
        <p className="text-muted text-sm">Este lanzamiento necesita al menos tres canciones para crear un top 3.</p>
      ) : editing ? (
        <form onSubmit={(event) => { event.preventDefault(); save(); }}>
          <div className="grid sm:grid-cols-3 gap-4">
            {[0, 1, 2].map((index) => (
              <label key={index} className="block text-sm font-semibold">
                <span className="text-teal block mb-2">Puesto {index + 1}</span>
                <select className="form-input w-full" disabled={busy} required value={draft[index]} onChange={(event) => {
                  setDraft(draft.map((id, position) => position === index ? event.target.value : id));
                }}>
                  <option value="">Elige una canción</option>
                  {tracks.map((track) => <option key={track.id} value={track.id} disabled={draft.includes(track.id) && draft[index] !== track.id}>{track.title}</option>)}
                </select>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 mt-5">
            <button className="btn btn-primary text-xs" disabled={busy || draft.some((id) => !id) || new Set(draft).size !== 3}>Guardar top 3</button>
            <button type="button" className="btn btn-outline text-xs" disabled={busy} onClick={() => { setEditing(false); setError(""); }}>Cancelar</button>
          </div>
        </form>
      ) : (
        <ol className="grid sm:grid-cols-3 gap-3">
          {[0, 1, 2].map((index) => <li key={index} className="card-alt p-4 flex items-start gap-3">
            <span className="font-display text-2xl text-teal">{index + 1}</span>
            <span className={`text-sm pt-1 break-words ${saved[index] ? "font-semibold" : "text-muted"}`}>{tracks.find((track) => track.id === saved[index])?.title || "Por elegir"}</span>
          </li>)}
        </ol>
      )}
      <p className="text-muted text-xs mt-4">{databaseReady ? "La selección se guarda en la cuenta de su autor." : "La sincronización estará disponible al activar la actualización. Tu selección local se conserva."}</p>
      {message && <p role="status" className="text-teal text-xs mt-3">{message}</p>}
      {error && <p role="alert" className="text-sm mt-3">{error}</p>}
    </section>
  );
}
