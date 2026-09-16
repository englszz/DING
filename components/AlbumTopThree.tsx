"use client";

import { useEffect, useState } from "react";

type Track = { id: string; title: string };

export function AlbumTopThree({ albumId, userId, tracks }: {
  albumId: string;
  userId: string;
  tracks: Track[];
}) {
  const storageKey = `ding:top-three:${userId}:${albumId}`;
  const [saved, setSaved] = useState<string[]>([]);
  const [draft, setDraft] = useState<string[]>(["", "", ""]);
  const [editing, setEditing] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const read = () => {
    try {
      setSaved([]);
      const value: unknown = JSON.parse(localStorage.getItem(storageKey) || "[]");
      if (Array.isArray(value) && value.length === 3 && new Set(value).size === 3 &&
        value.every((id) => typeof id === "string" && tracks.some((track) => track.id === id))) {
        setSaved(value);
        setDraft(value);
      }
    } catch {
      setError("No pudimos leer tu top 3 en este navegador.");
    }
    setReady(true);
    };
    const timer = window.setTimeout(read, 0);
    const sync = (event: StorageEvent) => { if (event.key === storageKey) read(); };
    window.addEventListener("storage", sync);
    return () => { window.clearTimeout(timer); window.removeEventListener("storage", sync); };
  }, [storageKey, tracks]);

  function save() {
    if (draft.some((id) => !tracks.some((track) => track.id === id)) || new Set(draft).size !== 3) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
      setSaved([...draft]);
      setEditing(false);
      setError("");
      setMessage("Tu top 3 está guardado.");
    } catch {
      setError("No se pudo guardar. Comprueba que el navegador permita almacenamiento local y vuelve a intentarlo.");
    }
  }

  return (
    <section className="card p-5 sm:p-6 mb-8" aria-labelledby="top-three-title">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-2">
        <h2 id="top-three-title" className="font-display text-teal text-xl">Mi top 3 del álbum</h2>
        {!editing && ready && tracks.length >= 3 && (
          <button className="btn btn-outline text-xs" onClick={() => {
            setDraft(saved.length ? [...saved] : ["", "", ""]);
            setEditing(true);
            setMessage("");
          }}>{saved.length ? "Editar mi top 3" : "Elegir mis canciones"}</button>
        )}
      </div>
      <p className="text-muted text-sm mb-5">Tus tres favoritas, en el orden que tú elijas. Independientes de tus notas.</p>
      {!ready ? <p role="status">Cargando tu selección…</p> : tracks.length < 3 ? (
        <p className="text-muted text-sm">Este lanzamiento necesita al menos tres canciones para crear un top 3.</p>
      ) : editing ? (
        <form onSubmit={(event) => { event.preventDefault(); save(); }}>
          <div className="grid sm:grid-cols-3 gap-4">
            {[0, 1, 2].map((index) => (
              <label key={index} className="block text-sm font-semibold">
                <span className="text-teal block mb-2">Puesto {index + 1}</span>
                <select className="form-input w-full" required value={draft[index]} onChange={(event) => {
                  setDraft(draft.map((id, position) => position === index ? event.target.value : id));
                }}>
                  <option value="">Elige una canción</option>
                  {tracks.map((track) => <option key={track.id} value={track.id} disabled={draft.includes(track.id) && draft[index] !== track.id}>{track.title}</option>)}
                </select>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 mt-5">
            <button className="btn btn-primary text-xs" disabled={draft.some((id) => !id) || new Set(draft).size !== 3}>Guardar top 3</button>
            <button type="button" className="btn btn-outline text-xs" onClick={() => { setEditing(false); setError(""); }}>Cancelar</button>
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
      <p className="text-muted text-xs mt-4">Vista local: tu selección se guarda en este navegador para tu cuenta.</p>
      {message && <p role="status" className="text-teal text-xs mt-3">{message}</p>}
      {error && <p role="alert" className="text-sm mt-3">{error}</p>}
    </section>
  );
}
