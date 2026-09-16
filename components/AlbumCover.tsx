"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { SearchResultAlbum } from "@/types";

type CoverAlbum = Pick<SearchResultAlbum, "mbid" | "entityType" | "title" | "coverUrl">;
type CoverProps = { album: CoverAlbum; sizes: string; priority?: boolean };
export function AlbumCover(props: CoverProps) {
  return <AlbumCoverImage key={`${props.album.entityType}:${props.album.mbid}:${props.album.coverUrl || ""}`} {...props} />;
}
function AlbumCoverImage({ album, sizes, priority = false }: CoverProps) {
  const [src, setSrc] = useState(album.coverUrl?.replace(/\/front-250$/, "/front-500") || "");
  const [loaded, setLoaded] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [recover, setRecover] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [visible, setVisible] = useState(priority);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || loaded || unavailable) return;
    if (recover || !src) {
      const controller = new AbortController();
      fetch(`/api/album/cover?type=${album.entityType || "release"}&id=${encodeURIComponent(album.mbid)}`, { signal: controller.signal })
        .then(async response => {
          const result = await response.json();
          if (controller.signal.aborted) return;
          const alternative = response.ok ? result.covers?.find((cover: string) => cover !== src) : null;
          if (alternative) { setSrc(alternative); setRecover(false); setFallback(true); }
          else setUnavailable(true);
        }).catch(() => { if (!controller.signal.aborted) setUnavailable(true); });
      return () => controller.abort();
    }
    const timer = window.setTimeout(() => { if (fallback) setUnavailable(true); else setRecover(true); }, 7000);
    return () => window.clearTimeout(timer);
  }, [visible, loaded, unavailable, recover, album.entityType, album.mbid, src, fallback]);

  return <div ref={container} className="absolute inset-0 bg-[var(--color-surface-alt)]">
    {!loaded && <div className="absolute inset-0 flex items-center justify-center text-[var(--color-accent-2)]" role="img" aria-label={unavailable ? `Portada no disponible: ${album.title}` : `Cargando portada: ${album.title}`}>
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true"><circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="1.5" /><circle cx="16" cy="16" r="3" stroke="currentColor" strokeWidth="1.5" /></svg>
    </div>}
    {src && !unavailable && <Image key={src} src={src} alt={album.title} fill sizes={sizes} priority={priority}
      className={`object-contain transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`}
      onLoad={() => setLoaded(true)} onError={() => { if (fallback || recover) setUnavailable(true); else setRecover(true); }} />}
  </div>;
}
