"use client";
import { useEffect, useState } from "react";
import type { SearchResultAlbum } from "@/types";
import { AlbumCover } from "@/components/AlbumCover";
import { editionKind, editionLabels } from "@/lib/albums/search-filters";

export function AlbumEditions({ album, onSelect, busy }: {
  album: SearchResultAlbum;
  onSelect: (album: SearchResultAlbum) => void;
  busy: boolean;
}) {
  const [editions, setEditions] = useState<SearchResultAlbum[] | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [variant, setVariant] = useState("all");
  const [count, setCount] = useState(6);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/album/editions?id=${encodeURIComponent(album.mbid)}`, { signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!controller.signal.aborted) setEditions(data.editions);
      }).catch(error => { if (!controller.signal.aborted) setError(error.message || "No pudimos cargar las ediciones."); });
    return () => controller.abort();
  }, [album.mbid, retry]);
  const visible = (editions || []).filter(edition => variant === "all" || editionKind(edition.title, edition.editionDescription) === variant);
  return <section className="w-full border-t border-[var(--color-border)] pt-4" aria-label={`Ediciones de ${album.title}`}>
    <p className="text-sm font-semibold">Elige la edición que escuchaste</p>
    <p className="text-xs text-muted mt-2 mb-4">Una edición puede tener otra portada o canciones adicionales. Tu elección abrirá esa versión concreta.</p>
    {error ? <p role="alert" className="text-sm">{error} <button className="text-teal underline" onClick={() => { setError(""); setRetry(retry + 1); }}>Reintentar</button></p> : !editions ? <p role="status" className="text-sm text-muted">Cargando ediciones…</p> : <>
      <label className="text-xs text-muted">Filtrar ediciones
        <select className="form-input mt-2 mb-4" value={variant} onChange={event => { setVariant(event.target.value); setCount(6); }}>
          <option value="all">Todas las ediciones ({editions.length})</option>
          {Object.entries(editionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      {!visible.length && <p className="text-sm text-muted">No hay ediciones de esta variante en el catálogo.</p>}
      <ul className="space-y-3">
        {visible.slice(0, count).map(edition => <li key={edition.mbid} className="card-alt p-3 flex flex-wrap gap-3 items-center">
          <div className="relative w-14 h-14 shrink-0"><AlbumCover album={edition} sizes="56px" /></div>
          <div className="flex-1 min-w-0 text-sm">
            <p className="font-semibold break-words">{edition.title}</p>
            <p className="text-muted text-xs mt-1">{edition.year || "Sin fecha"} · {edition.country === "XW" ? "Internacional" : edition.country || "País no indicado"} · {editionLabels[editionKind(edition.title, edition.editionDescription)]}</p>
            {edition.editionDescription && <p className="text-muted text-xs mt-1 break-words">{edition.editionDescription}</p>}
          </div>
          <button className="btn btn-outline text-xs" disabled={busy} onClick={() => onSelect(edition)}>Abrir esta edición</button>
        </li>)}
      </ul>
      {visible.length > count && <button className="btn btn-ghost text-xs mt-3" onClick={() => setCount(count + 6)}>Ver más ediciones ({visible.length - count})</button>}
    </>}
  </section>;
}
