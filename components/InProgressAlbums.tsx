import Image from "next/image";
import Link from "next/link";
import type { AlbumProgress } from "@/lib/albums/progress";

export function InProgressAlbums({ albums, failed }: { albums: AlbumProgress[]; failed: boolean }) {
  if (failed) return <div className="card" role="alert">No pudimos cargar tus álbumes pendientes. <Link href="?tab=progress" className="text-teal underline">Reintentar</Link></div>;
  return <div>
    <p className="text-muted text-sm mb-6">Tus notas se guardan al salir de cada casilla o pulsar Enter. Estos álbumes pasan a «Álbumes calificados» cuando guardas la calificación general, incluso si ya puntuaste todas sus canciones.</p>
    {!albums.length ? <div className="card p-8 text-center text-muted text-sm">No tienes álbumes a medio calificar. Cuando puntúes una canción, el álbum aparecerá aquí automáticamente.</div> : (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {albums.map((album) => <Link key={album.id} href={`/album/${album.id}#${album.rated === album.total ? "album-rating" : "tracklist"}`} className="card-album block">
          <div className="aspect-square relative bg-[var(--color-surface-alt)]">
            <Image src={album.cover_url || "/assets/icon-blue.png"} alt={album.title} fill sizes="(max-width:768px) 50vw,25vw" className="object-cover" />
          </div>
          <div className="p-4">
            <p className="font-display font-semibold truncate">{album.title}</p>
            <p className="text-muted text-xs mt-2 truncate">{album.artist_name}</p>
            <p className="text-sm text-teal font-semibold mt-4">{album.rated} de {album.total} canciones</p>
            <progress aria-label={`Progreso de ${album.title}`} value={album.rated} max={album.total || 1} className="album-progress mt-2" />
            <p className="text-muted text-xs mt-3">{album.rated === album.total ? "Solo falta tu nota general →" : "Continuar calificando →"}</p>
          </div>
        </Link>)}
      </div>
    )}
  </div>;
}
