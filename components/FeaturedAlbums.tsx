"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

// Editorial selection: verified MusicBrainz release groups, not personalized recommendations.
const albums = [
  { id: "eac07d92-86b1-4fa7-906d-ec3177f8ebc2", title: "UTOPIA", artist: "Travis Scott" },
  { id: "aa997ea0-2936-40bd-884d-3af8a0e064dc", title: "Random Access Memories", artist: "Daft Punk" },
  { id: "668e80e0-b35e-4471-9788-0a3d797fe42c", title: "Melodrama", artist: "Lorde" },
  { id: "e992b449-141b-4aea-b07b-9b2a478a8570", title: "Un verano sin ti", artist: "Bad Bunny" },
  { id: "6eac2e57-ee50-36f8-b0c4-c4c847a2c098", title: "Back to Black", artist: "Amy Winehouse" },
  { id: "9162580e-5df4-32de-80cc-f45a8d8a9b1d", title: "Abbey Road", artist: "The Beatles" },
];

export function FeaturedAlbums({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function openAlbum(id: string) {
    if (!signedIn) { router.push("/login"); return; }
    setOpening(id);
    setError(null);
    try {
      const response = await fetch("/api/album/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mbid: id, entityType: "release-group" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No pudimos abrir el álbum. Inténtalo de nuevo.");
      router.push(`/album/${data.albumId}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "No pudimos conectar. Inténtalo de nuevo.");
    } finally { setOpening(null); }
  }
  return (
    <section className="page-container w-full py-8 sm:py-10" aria-labelledby="next-listen-title">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-teal text-xs font-semibold uppercase tracking-wider mb-2">Selección de DING</p>
          <h2 id="next-listen-title" className="section-title" style={{ marginBottom: "8px" }}>Tu próxima escucha</h2>
          <p className="text-muted text-sm leading-relaxed">Descubre álbumes para añadir a tu diario.</p>
        </div>
        <Link href={signedIn ? "/search" : "/login"} className="text-teal text-sm font-semibold hover:underline">Explorar más →</Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-6">
        {albums.map(album => <button key={album.id} type="button"
          className="card-album flex flex-col text-left cursor-pointer disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal"
          disabled={opening !== null} onClick={() => openAlbum(album.id)}
          aria-label={`Ver ${album.title} de ${album.artist}`}>
          <AlbumCover id={album.id} title={album.title} />
          <div className="p-3 sm:p-4 flex flex-col flex-1 w-full">
            <p className="font-semibold text-sm leading-snug min-h-[2.5em]">{album.title}</p>
            <p className="text-muted text-xs mt-2 leading-relaxed">{album.artist}</p>
            <p className="text-teal text-xs font-medium mt-4">{opening === album.id ? "Abriendo…" : "Ver álbum →"}</p>
          </div>
        </button>)}
      </div>
      {!signedIn && <p className="text-muted text-xs mt-4">Inicia sesión para abrir los álbumes y registrarlos en tu diario.</p>}
      {error && <p role="alert" className="text-sm mt-4">{error} Puedes volver a seleccionar el álbum.</p>}
    </section>
  );
}

function AlbumCover({ id, title }: { id: string; title: string }) {
  const [failed, setFailed] = useState(false);
  return <div className="relative aspect-square w-full bg-[var(--color-surface-alt)] border-b border-[var(--color-border)]">
    {failed ? <div className="absolute inset-0 flex items-center justify-center text-teal text-4xl" aria-label="Portada no disponible">♫</div> :
      <Image src={`https://coverartarchive.org/release-group/${id}/front-500`} alt={title} fill
        sizes="(max-width: 767px) 45vw, (max-width: 1023px) 30vw, 180px" className="object-cover" onError={() => setFailed(true)} />}
  </div>;
}
