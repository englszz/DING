"use client";
import { ItunesBadge } from "@/components/ItunesBadge";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { SearchResultAlbum } from "@/types";
import { openAlbum } from "@/lib/albums/open";
import { useRouter } from "next/navigation";
import Image from "next/image";
const key = (album: SearchResultAlbum) =>
  `${album.entityType || "release"}:${album.mbid}`;
type Library = {
  albums: SearchResultAlbum[];
  ready: boolean;
  error: string;
  refresh: () => Promise<void>;
  toggle: (album: SearchResultAlbum) => Promise<string>;
};
const Context = createContext<Library | null>(null);
export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [albums, setAlbums] = useState<SearchResultAlbum[]>([]),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const db = createClient();
      const { data, error } = await db
        .from("saved_albums")
        .select("external_id,entity_type,title,artist,year,cover_url")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setAlbums(
        (data || []).map((a) => ({
          mbid: a.external_id,
          entityType: a.entity_type,
          title: a.title,
          artist: a.artist,
          year: a.year,
          coverUrl: a.cover_url,
        })),
      );
      setError("");
      const missing=(data||[]).filter(a=>a.entity_type==="itunes"&&!a.cover_url).map(a=>a.external_id);
      if(missing.length){
        void fetch("/api/album/artwork",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ids:missing.slice(0,20)})}).then(r=>r.ok?r.json():null).then(result=>{if(!result?.covers)return;const covers=new Map<string,string>(result.covers.map((c:{id:string;url:string})=>[c.id,c.url]));setAlbums(prev=>prev.map(a=>a.entityType==="itunes"&&!a.coverUrl&&covers.has(a.mbid)?{...a,coverUrl:covers.get(a.mbid)}:a));}).catch(()=>{});
      }
    } catch {
      setError("No pudimos cargar los álbumes guardados.");
    } finally {
      setReady(true);
    }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      void refresh();
    }, 0);
    const handler = () => {
      void refresh();
    };
    window.addEventListener("ding-library-changed", handler);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("ding-library-changed", handler);
    };
  }, [refresh]);
  async function toggle(album: SearchResultAlbum) {
    const db = createClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) throw new Error("Inicia sesión para guardar álbumes.");
    if (albums.some((a) => key(a) === key(album))) {
      const { error } = await db
        .from("saved_albums")
        .delete()
        .eq("user_id", user.id)
        .eq("external_id", album.mbid)
        .eq("entity_type", album.entityType || "release");
      if (error) throw error;
      setAlbums((prev) => prev.filter((a) => key(a) !== key(album)));
      return "Eliminado de guardados";
    }
    const { data, error } = await db.rpc("ding_save_album", {
      p_external_id: album.mbid,
      p_entity_type: album.entityType || "release",
      p_title: album.title,
      p_artist: album.artist,
      p_cover_url: album.coverUrl || null,
      p_year: album.year || null,
    });
    if (error) throw error;
    if (!data) return "Ya calificaste este álbum";
    setAlbums((prev) => [album, ...prev.filter((a) => key(a) !== key(album))]);
    return "Guardado en tu lista privada";
  }
  return (
    <Context.Provider value={{ albums, ready, error, refresh, toggle }}>
      {children}
    </Context.Provider>
  );
}
export function SaveAlbumButton({ album }: { album: SearchResultAlbum }) {
  const library = useContext(Context),
    lock = useRef(false);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  if (!library) return null;
  const saved = library.albums.some((a) => key(a) === key(album));
  return (
    <div className="flex flex-col gap-1">
      <button
        className="btn btn-outline text-xs"
        disabled={busy || !library.ready}
        aria-pressed={saved}
        onClick={async () => {
          if (lock.current) return;
          lock.current = true;
          setBusy(true);
          try {
            setMessage(await library.toggle(album));
          } catch (e) {
            setMessage(
              e instanceof Error && e.message.includes("Inicia")
                ? e.message
                : "No se pudo guardar. Inténtalo de nuevo.",
            );
          } finally {
            lock.current = false;
            setBusy(false);
          }
        }}
      >
        {busy ? "Guardando…" : saved ? "Guardado ✓" : "Guardar álbum"}
      </button>
      {message && (
        <p role="status" className="text-xs text-muted max-w-48">
          {message}
        </p>
      )}
    </div>
  );
}
export function SavedAlbums() {
  const library = useContext(Context),
    router = useRouter();
  const [busy, setBusy] = useState<string | null>(null),
    [error, setError] = useState("");
  if (!library) return null;
  return (
    <div>
      <p className="text-muted text-sm mb-6">
        Solo tú puedes ver esta lista. Al calificar un álbum pasa a Álbumes
        calificados.
      </p>
      {!library.ready && <p>Cargando…</p>}
      {library.error && (
        <p role="alert">
          {library.error} <button onClick={library.refresh}>Reintentar</button>
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {library.ready && !library.error && !library.albums.length && (
        <p className="card">Todavía no has guardado álbumes.</p>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {library.albums.map((album) => (
          <div className="card-album relative overflow-hidden focus-within:ring-2 focus-within:ring-cyan-400" key={key(album)}>
            <div className="aspect-square relative bg-[var(--color-surface-alt)]">
              <Image
                src={album.coverUrl || "/assets/icon-blue.png"}
                alt={album.title}
                fill
                sizes="(max-width:768px) 50vw,25vw"
                className="object-cover"
              />
            </div>
            <div className="p-4 space-y-3">
              <p className="font-display">{album.title}</p>
              <p className="text-muted text-xs">{album.artist}</p>
              <button
                className="text-xs text-muted after:absolute after:inset-0 after:content-[''] enabled:cursor-pointer disabled:cursor-wait focus:outline-none"
                disabled={busy !== null}
                aria-label={`Abrir ${album.title} de ${album.artist}`}
                onClick={async () => {
                  setBusy(key(album));
                  setError("");
                  try {
                    router.push(`/album/${await openAlbum(album)}`);
                  } catch {
                    setError("No pudimos abrir el álbum. Inténtalo de nuevo.");
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                {busy === key(album) ? "Abriendo…" : "Abrir álbum"}
              </button>
              <div className="relative z-10 w-fit">
                <SaveAlbumButton album={album} />
              </div>
              <div className="relative z-10 w-fit">
                <ItunesBadge id={album.entityType==="itunes"?album.mbid:album.artworkItunesId} coverUrl={album.coverUrl} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
