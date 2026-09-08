"use client";
import { ItunesBadge } from "@/components/ItunesBadge";
import { ArtistPortrait } from "@/components/ArtistPortrait";
import { SaveAlbumButton } from "@/components/AlbumLibrary";

import { useState, useEffect, useRef } from "react";
import { openAlbum } from "@/lib/albums/open";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMagnifyingGlass,
  faPlus,
  faUser,
  faCompactDisc,
  faSpinner,
  faUsers,
  faArrowLeft,
  faCrown,
} from "@fortawesome/free-solid-svg-icons";
import type { SearchResultAlbum, SearchResultUser } from "@/types";
import { releaseKinds, releaseKindLabels, type ReleaseKind } from "@/lib/musicbrainz/search";

interface ArtistResult {
  source?: "musicbrainz" | "itunes";
  id: string;
  name: string;
  type?: string;
  country?: string;
  disambiguation?: string;
  score?: number;
  imageUrl?: string | null;
}

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"albums" | "artists" | "users">("albums");
  const [albums, setAlbums] = useState<SearchResultAlbum[]>([]);
  const [users, setUsers] = useState<SearchResultUser[]>([]);
  const [artists, setArtists] = useState<ArtistResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [importingMbid, setImportingMbid] = useState<string | null>(null);
  const [discography, setDiscography] = useState<SearchResultAlbum[] | null>(null);
  const [discographyArtist, setDiscographyArtist] = useState<ArtistResult | null>(null);
  const [loadingDiscography, setLoadingDiscography] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const [kind, setKind] = useState<ReleaseKind>("album");
  const [error, setError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [restored, setRestored] = useState(false);
  const skipRestoredSearch = useRef(false);
  const restoredScroll = useRef<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const raw = window.sessionStorage.getItem("ding-search-return-v1");
        window.sessionStorage.removeItem("ding-search-return-v1");
        const saved = raw ? JSON.parse(raw) : null;
        if (saved && Date.now() - saved.savedAt < 3600000 &&
          typeof saved.query === "string" && ["albums", "artists", "users"].includes(saved.activeTab) &&
          releaseKinds.includes(saved.kind) && Array.isArray(saved.albums) &&
          Array.isArray(saved.artists) && Array.isArray(saved.users) &&
          (saved.discography === null || Array.isArray(saved.discography))) {
          setQuery(saved.query);
          setActiveTab(saved.activeTab);
          setKind(saved.kind);
          setAlbums(saved.albums);
          setArtists(saved.artists);
          setUsers(saved.users);
          setDiscography(saved.discography);
          setDiscographyArtist(saved.discographyArtist);
          setHasSearched(true);
          skipRestoredSearch.current = true;
          restoredScroll.current = Number.isFinite(saved.scrollY) ? saved.scrollY : 0;
        }
      } catch { /* Storage may be unavailable; normal search still works. */ }
      setRestored(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!restored || restoredScroll.current === null) return;
    const timer = setTimeout(() => {
      window.scrollTo(0, restoredScroll.current || 0);
      restoredScroll.current = null;
    }, 0);
    return () => clearTimeout(timer);
  }, [restored]);

  const resetRequest = () => {
    abortRef.current?.abort();
    setError(null);
    setImportError(null);
    setAlbums([]);
    setArtists([]);
    setUsers([]);
    setDiscography(null);
    setHasSearched(false);
    setIsLoading(false);
    setLoadingDiscography(false);
  };

  useEffect(() => {
    if (!restored) return;
    if (skipRestoredSearch.current) {
      skipRestoredSearch.current = false;
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    const run = async () => {
      if (!discographyArtist && query.trim().length < 2) return;
      setError(null);
      setHasSearched(false);
      if (discographyArtist) setLoadingDiscography(true);
      else setIsLoading(true);
      try {
        const res = discographyArtist
          ? await fetch("/api/search", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ artistId: discographyArtist.id, artistName: discographyArtist.name, source: discographyArtist.source || "musicbrainz", kind }),
              signal: controller.signal,
            })
          : await fetch(`/api/search?q=${encodeURIComponent(query)}&type=${activeTab}&kind=${kind}`,
              { signal: controller.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "No pudimos completar la búsqueda.");
        if (controller.signal.aborted) return;
        if (discographyArtist) setDiscography(data.albums || []);
        else {
          setAlbums(data.albums || []);
          setUsers(data.users || []);
          setArtists(data.artists || []);
        }
        setHasSearched(true);
      } catch (err: unknown) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "No pudimos conectar. Inténtalo de nuevo.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
          setLoadingDiscography(false);
        }
      }
    };
    const timer = setTimeout(run, discographyArtist ? 0 : 550);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, activeTab, kind, discographyArtist, retry, restored]);

  const handleViewAlbum = async (album: SearchResultAlbum) => {
    setImportingMbid(album.mbid);
    setImportError(null);
    try {
      const albumId = await openAlbum(album);
      try {
        window.sessionStorage.setItem("ding-search-return-v1", JSON.stringify({
          savedAt: Date.now(), query, activeTab, kind, albums, artists, users,
          discography, discographyArtist, scrollY: window.scrollY,
        }));
      } catch { /* Opening an album must not depend on browser storage. */ }
      router.push(`/album/${albumId}`);
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : "No pudimos abrir el álbum.");
    } finally {
      setImportingMbid(null);
    }
  };

  const handleViewDiscography = (artist: ArtistResult) => {
    resetRequest();
    setKind("album");
    setDiscographyArtist(artist);
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    resetRequest();
    setQuery(e.target.value);
    // Leave discography view when starting a new search
    if (discographyArtist) {
      setDiscography(null);
      setDiscographyArtist(null);
      setActiveTab("albums");
      setKind("album");
    }
  };

  const changeTab = (tab: "albums" | "artists" | "users") => {
    if (tab === activeTab) return;
    resetRequest();
    setActiveTab(tab);
  };

  const hasQuery = query.trim().length >= 2;
  const isDiscographyView = discographyArtist !== null;

  return (
    <div className="page-container py-4 flex-1 w-full max-w-4xl">
      {/* Header */}
      <div className="mb-8 border-b border-[var(--color-border)] pb-6">
        <h1 className="font-display text-teal text-3xl md:text-4xl mb-2">
          {isDiscographyView ? discographyArtist.name : "Buscador Global"}
        </h1>
        <p className="text-muted text-sm font-medium">
          {isDiscographyView
            ? `Discografía de ${discographyArtist.name}`
            : "Busca álbumes, artistas o usuarios de la comunidad"}
        </p>
      </div>

      {/* Search Input */}
      <div className="relative mb-8 flex items-center">
        <FontAwesomeIcon
          icon={faMagnifyingGlass}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-muted text-base z-10 pointer-events-none"
        />
        {isLoading && (
          <FontAwesomeIcon
            icon={faSpinner}
            spin
            className="absolute right-4 top-1/2 -translate-y-1/2 text-teal text-sm z-10 pointer-events-none"
          />
        )}
        <input
          type="text"
          value={query}
          onChange={handleQueryChange}
          aria-label="Buscar álbumes, artistas o usuarios"
          maxLength={200}
          placeholder={activeTab === "albums" || isDiscographyView ? "Buscar álbum o artista" : "Escribe un artista o usuario..."}
          className="form-input text-base py-3.5"
          style={{ paddingLeft: "52px" }}
        />
      </div>

      {/* Tabs */}
      {!isDiscographyView && (
        <div className="flex items-center gap-2 sm:gap-4 mb-6 border-b border-[var(--color-border)] pb-4 overflow-x-auto">
          <button
            type="button"
            onClick={() => changeTab("albums")}
            className={`btn text-xs sm:text-sm font-medium whitespace-nowrap ${activeTab === "albums" ? "btn-primary" : "btn-ghost"}`}
          >
            <FontAwesomeIcon icon={faCompactDisc} />
            <span>Álbumes</span>
          </button>
          <button
            type="button"
            onClick={() => changeTab("artists")}
            className={`btn text-xs sm:text-sm font-medium whitespace-nowrap ${activeTab === "artists" ? "btn-primary" : "btn-ghost"}`}
          >
            <FontAwesomeIcon icon={faUsers} />
            <span>Artistas</span>
          </button>
          <button
            type="button"
            onClick={() => changeTab("users")}
            className={`btn text-xs sm:text-sm font-medium whitespace-nowrap ${activeTab === "users" ? "btn-primary" : "btn-ghost"}`}
          >
            <FontAwesomeIcon icon={faUser} />
            <span>Usuarios</span>
          </button>
        </div>
      )}

      {(activeTab === "albums" || isDiscographyView) && (
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <label htmlFor="release-kind" className="text-sm text-muted">Tipo de lanzamiento</label>
          <select id="release-kind" value={kind}
            onChange={(event) => { resetRequest(); setKind(event.target.value as ReleaseKind); }}
            className="form-input text-sm" style={{ width: "auto", minWidth: "180px" }}>
            <optgroup label="Tipos">
              {releaseKinds.slice(0, 4).map(value => <option key={value} value={value}>{releaseKindLabels[value]}</option>)}
            </optgroup>
            <optgroup label="Otros lanzamientos">
              {releaseKinds.slice(4).map(value => <option key={value} value={value}>{releaseKindLabels[value]}</option>)}
            </optgroup>
          </select>
        </div>
      )}

      {error && <div role="alert" className="card p-4 mb-4 flex flex-wrap items-center gap-3">
        <p className="text-sm">{error}</p>
        <button type="button" className="btn btn-outline text-sm" onClick={() => { resetRequest(); setRetry(value => value + 1); }}>Reintentar</button>
      </div>}
      {importError && <p role="alert" className="text-sm mb-4">{importError} Puedes volver a pulsar «Ver álbum».</p>}

      {/* Discography View */}
      {isDiscographyView && (
        <div className="mb-6">
          <button
            type="button"
            onClick={() => {
              resetRequest();
              setDiscographyArtist(null);
            }}
            className="btn btn-ghost text-sm mb-4"
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            <span>Volver a resultados</span>
          </button>
        </div>
      )}

      {/* Results */}
      <div className="flex flex-col gap-4" style={{ marginTop: "28px" }}>
        {!hasQuery && !isDiscographyView && (
          <p className="text-sm text-muted text-center py-12">
            Escribe al menos 2 caracteres para buscar.
          </p>
        )}

        {hasQuery && isLoading && !isDiscographyView && (
          <div className="flex flex-col items-center py-12 gap-3">
            <FontAwesomeIcon
              icon={faSpinner}
              spin
              className="text-teal text-xl"
            />
            <p className="text-sm text-muted">Buscando...</p>
          </div>
        )}

        {!error && hasQuery && !isLoading && hasSearched && !isDiscographyView && (activeTab === "albums" ? albums.length === 0 : activeTab === "artists" ? artists.length === 0 : users.length === 0) && (
          <p className="text-sm text-muted text-center py-12">
            {activeTab === "albums"
              ? "No se encontraron álbumes."
              : activeTab === "artists"
              ? "No se encontraron artistas."
              : "No se encontraron usuarios."}
          </p>
        )}

        {/* Discography loading */}
        {isDiscographyView && loadingDiscography && (
          <div className="flex flex-col items-center py-12 gap-3">
            <FontAwesomeIcon
              icon={faSpinner}
              spin
              className="text-teal text-xl"
            />
            <p className="text-sm text-muted">Cargando discografía...</p>
          </div>
        )}

        {/* Discography results */}
        {isDiscographyView && !loadingDiscography && discography && (
          <>
            {discography.length === 0 ? (
              <p className="text-sm text-muted text-center py-12">
                No se encontraron lanzamientos de este tipo en la discografía.
              </p>
            ) : (
              discography.map((album) => (
                <AlbumCard
                  key={album.mbid}
                  album={album}
                  importingMbid={importingMbid}
                  onViewAlbum={handleViewAlbum}
                />
              ))
            )}
          </>
        )}

        {!isDiscographyView && activeTab === "albums" && albums.some(album => album.approximate) && (
          <p role="status" className="text-sm text-muted">Quizás buscabas… Estas son coincidencias aproximadas.</p>
        )}

        {/* Album results */}
        {!isDiscographyView && activeTab === "albums" && albums.map((album) => (
          <AlbumCard
            key={album.mbid}
            album={album}
            importingMbid={importingMbid}
            onViewAlbum={handleViewAlbum}
          />
        ))}

        {/* Artist results */}
        {!isDiscographyView && activeTab === "artists" && artists.map((artist) => (
          <div
            key={artist.id}
            className="card p-4 flex flex-wrap gap-4 items-center justify-between hover:border-teal transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-[var(--color-surface-alt)] border border-[var(--color-border)] flex items-center justify-center flex-shrink-0 overflow-hidden relative">
                <ArtistPortrait name={artist.name} hint={artist.disambiguation} />
              </div>
              <div>
                <p className="font-display font-semibold text-[var(--color-text)] text-base">
                  {artist.name}
                </p>
                <p className="text-muted text-xs mt-0.5 font-medium">
                  {artist.type || "Artista"}
                  {artist.country ? ` · ${artist.country}` : ""}
                  {artist.disambiguation ? ` · ${artist.disambiguation}` : ""}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleViewDiscography(artist)}
              className="btn btn-outline text-xs py-2 px-4"
            >
              <FontAwesomeIcon icon={faCompactDisc} className="text-teal" />
              <span>Discografía</span>
            </button>
          </div>
        ))}

        {/* User results */}
        {!isDiscographyView && activeTab === "users" && users.map((user) => (
          <div
            key={user.username}
            className="card p-4 flex items-center justify-between hover:border-teal transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[var(--color-surface-alt)] border border-[var(--color-border)] flex items-center justify-center relative overflow-hidden flex-shrink-0">
                {user.avatarUrl ? (
                  <Image
                    src={user.avatarUrl}
                    alt={user.displayName || user.username}
                    fill
                    className="object-cover"
                    sizes="48px"
                  />
                ) : (
                  <span className="font-bold text-teal">
                    {(user.displayName || user.username).charAt(0)}
                  </span>
                )}
              </div>
              <div>
                <p className="font-bold text-[var(--color-text)] text-base flex items-center gap-2">
                  {user.displayName || user.username}
                  {user.isAdmin && (
                    <span className="inline-flex items-center gap-1 bg-teal text-white text-[10px] font-bold px-2 py-0.5">
                      <FontAwesomeIcon icon={faCrown} className="text-[9px]" />
                      Administrador
                    </span>
                  )}
                </p>
                <p className="text-muted text-xs font-medium">
                  @{user.username}
                </p>
              </div>
            </div>

            <Link
              href={`/profile/${user.username}`}
              className="btn btn-outline text-xs py-2 px-4"
            >
              Ver perfil
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

function AlbumCard({
  album,
  importingMbid,
  onViewAlbum,
}: {
  album: SearchResultAlbum;
  importingMbid: string | null;
  onViewAlbum: (album: SearchResultAlbum) => void;
}) {
  const [failedCover, setFailedCover] = useState(false);
  return (
    <div
      key={album.mbid}
      className="card p-4 flex items-center justify-between hover:border-teal transition-colors"
    >
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-[var(--color-surface-alt)] border border-[var(--color-border)] flex items-center justify-center relative flex-shrink-0 overflow-hidden">
          {album.coverUrl && !failedCover ? (
            <Image
              src={album.coverUrl}
              onError={() => setFailedCover(true)}
              alt={album.title}
              fill
              className="object-cover"
              sizes="56px"
            />
          ) : (
            <FontAwesomeIcon
              icon={faCompactDisc}
              className="text-teal text-xl"
            />
          )}
        </div>
        <div>
          <p className="font-display font-semibold text-[var(--color-text)] text-base">
            {album.title}
          </p>
          <p className="text-muted text-xs mt-0.5 font-medium">
            {album.artist}
            {album.year ? ` · ${album.year}` : ""}
          </p>
          <ItunesBadge id={album.artworkItunesId || (album.entityType==="itunes"?album.mbid:undefined)} coverUrl={album.coverUrl} />
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-3">
      <SaveAlbumButton album={album} />
      <button
        type="button"
        onClick={() => onViewAlbum(album)}
        disabled={importingMbid !== null}
        className="btn btn-outline text-xs py-2 px-4"
      >
        {importingMbid === album.mbid ? (
          <FontAwesomeIcon icon={faSpinner} spin className="text-teal" />
        ) : (
          <FontAwesomeIcon icon={faPlus} className="text-teal" />
        )}
        <span>
          {importingMbid === album.mbid ? "Cargando..." : "Ver álbum"}
        </span>
      </button>
      </div>
    </div>
  );
}

