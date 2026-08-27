"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMagnifyingGlass,
  faPlus,
  faUser,
  faCompactDisc,
  faStar,
  faSpinner,
  faUsers,
  faArrowLeft,
} from "@fortawesome/free-solid-svg-icons";
import type { SearchResultAlbum, SearchResultUser } from "@/types";

interface ArtistResult {
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

  const performSearch = useCallback(
    async (q: string, type: "albums" | "artists" | "users") => {
      if (q.trim().length < 2) {
        setAlbums([]);
        setUsers([]);
        setArtists([]);
        setHasSearched(false);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q)}&type=${type}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();
        setAlbums(data.albums || []);
        setUsers(data.users || []);
        setArtists(data.artists || []);
        setHasSearched(true);
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setAlbums([]);
          setUsers([]);
          setArtists([]);
          setHasSearched(true);
        }
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query, activeTab);
    }, 400);
    return () => clearTimeout(timer);
  }, [query, activeTab, performSearch]);

  useEffect(() => {
    if (query.trim().length >= 2) {
      performSearch(query, activeTab);
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleViewAlbum = async (mbid: string) => {
    setImportingMbid(mbid);
    try {
      const res = await fetch("/api/album/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mbid }),
      });
      if (!res.ok) throw new Error("Import failed");
      const { albumId } = await res.json();
      router.push(`/album/${albumId}`);
    } catch {
      setImportingMbid(null);
    }
  };

  const handleViewDiscography = async (artist: ArtistResult) => {
    setDiscographyArtist(artist);
    setLoadingDiscography(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistId: artist.id }),
      });
      const data = await res.json();
      setDiscography(data.albums || []);
    } catch {
      setDiscography([]);
    }
    setLoadingDiscography(false);
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
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Escribe un álbum, artista o usuario..."
          className="form-input text-base py-3.5"
          style={{ paddingLeft: "52px" }}
        />
      </div>

      {/* Tabs */}
      {!isDiscographyView && (
        <div className="flex items-center gap-4 mb-6 border-b border-[var(--color-border)] pb-4">
          <button
            type="button"
            onClick={() => setActiveTab("albums")}
            className={`btn text-sm font-medium ${activeTab === "albums" ? "btn-primary" : "btn-ghost"}`}
          >
            <FontAwesomeIcon icon={faCompactDisc} />
            <span>Álbumes</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("artists")}
            className={`btn text-sm font-medium ${activeTab === "artists" ? "btn-primary" : "btn-ghost"}`}
          >
            <FontAwesomeIcon icon={faUsers} />
            <span>Artistas</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`btn text-sm font-medium ${activeTab === "users" ? "btn-primary" : "btn-ghost"}`}
          >
            <FontAwesomeIcon icon={faUser} />
            <span>Usuarios</span>
          </button>
        </div>
      )}

      {/* Discography View */}
      {isDiscographyView && (
        <div className="mb-6">
          <button
            type="button"
            onClick={() => {
              setDiscography(null);
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

        {hasQuery && !isLoading && hasSearched && !isDiscographyView && (activeTab === "albums" ? albums.length === 0 : activeTab === "artists" ? artists.length === 0 : users.length === 0) && (
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
                No se encontraron álbumes en la discografía.
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
            className="card p-4 flex items-center justify-between hover:border-teal transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-[var(--color-surface-alt)] border border-[var(--color-border)] flex items-center justify-center flex-shrink-0 overflow-hidden relative">
                {artist.imageUrl ? (
                  <Image
                    src={artist.imageUrl}
                    alt={artist.name}
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                ) : (
                  <FontAwesomeIcon
                    icon={faUsers}
                    className="text-accent-2 text-xl"
                  />
                )}
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
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-white bg-teal px-1.5 py-0.5">
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
  onViewAlbum: (mbid: string) => void;
}) {
  return (
    <div
      key={album.mbid}
      className="card p-4 flex items-center justify-between hover:border-teal transition-colors"
    >
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-[var(--color-surface-alt)] border border-[var(--color-border)] flex items-center justify-center relative flex-shrink-0 overflow-hidden">
          {album.coverUrl ? (
            <Image
              src={album.coverUrl}
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
        </div>
      </div>

      <button
        type="button"
        onClick={() => onViewAlbum(album.mbid)}
        disabled={importingMbid === album.mbid}
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
  );
}


