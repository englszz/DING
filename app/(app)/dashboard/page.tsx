import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faStar,
  faCompactDisc,
  faClock,
  faMagnifyingGlass,
  faChartLine,
  faRotateRight,
} from "@fortawesome/free-solid-svg-icons";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Fetch rated albums (latest 4 for stats grid)
  const { data: ratings } = await supabase
    .from("album_ratings")
    .select("id, rating, album_id, updated_at, albums(id, title, artist_name, cover_url)")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  // Fetch listen log (main content)
  const { data: listens } = await supabase
    .from("listen_log")
    .select("id, listened_at, album_id, albums(id, title, artist_name, cover_url)")
    .eq("user_id", user.id)
    .order("listened_at", { ascending: false });

  const totalRated = ratings?.length || 0;
  const avgRating =
    totalRated > 0
      ? (
          ratings!.reduce((sum, r) => sum + Number(r.rating), 0) / totalRated
        ).toFixed(1)
      : "—";

  const ratingMap = new Map(
    (ratings || []).map((r) => [r.album_id, Number(r.rating)])
  );

  // Detect re-listens
  const albumCount = new Map<string, number>();
  for (const entry of listens || []) {
    albumCount.set(entry.album_id, (albumCount.get(entry.album_id) || 0) + 1);
  }
  const albumSeen = new Map<string, number>();

  const formatRelativeDate = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Ahora";
    if (diffMins < 60) return `Hace ${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Hace ${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Ayer";
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  };

  return (
    <div className="page-container py-4 flex-1 w-full">
      {/* Header */}
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between border-b border-[var(--color-border)] pb-6 gap-4">
        <div>
          <h1 className="font-display text-teal text-3xl md:text-4xl">
            Hola, {profile?.display_name || profile?.username || ".usuario"}
          </h1>
          <p className="text-muted text-sm mt-1 font-medium">
            Tu diario musical
          </p>
        </div>

        <Link href="/search" className="btn btn-primary">
          <FontAwesomeIcon icon={faPlus} />
          <span>Registrar escucha</span>
        </Link>
      </header>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main: Diary Timeline */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <h2 className="section-title mb-0">Diario de Escuchas</h2>

          {!listens || listens.length === 0 ? (
            <div className="card p-12 text-center flex flex-col items-center justify-center">
              <FontAwesomeIcon
                icon={faCompactDisc}
                className="text-muted text-3xl mb-4 opacity-30"
              />
              <p className="text-muted text-sm mb-4">
                Tu diario está vacío. Busca un álbum y regístralo para empezar.
              </p>
              <Link href="/search" className="btn btn-outline text-xs">
                <FontAwesomeIcon icon={faMagnifyingGlass} className="text-accent-2" />
                <span>Buscar álbumes</span>
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {listens.map((entry) => {
                const album = entry.albums as any;
                if (!album) return null;

                const count = albumSeen.get(entry.album_id) || 0;
                albumSeen.set(entry.album_id, count + 1);
                const isReListen =
                  albumCount.get(entry.album_id)! > 1 && count > 0;
                const rating = ratingMap.get(entry.album_id);

                return (
                  <Link
                    key={entry.id}
                    href={`/album/${album.id}`}
                    className="card p-4 flex items-center justify-between hover:border-teal transition-colors block"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-[var(--color-surface-alt)] border border-[var(--color-border)] flex items-center justify-center flex-shrink-0 overflow-hidden relative">
                        {album.cover_url ? (
                          <Image
                            src={album.cover_url}
                            alt={album.title}
                            fill
                            sizes="56px"
                            className="object-cover"
                          />
                        ) : (
                          <FontAwesomeIcon
                            icon={faCompactDisc}
                            className="text-accent-2 text-xl"
                          />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-display font-semibold text-[var(--color-text)] text-base">
                            {album.title}
                          </p>
                          {isReListen && (
                            <span className="badge-accent text-[0.65rem] flex items-center gap-1">
                              <FontAwesomeIcon
                                icon={faRotateRight}
                                className="text-[9px]"
                              />
                              Reescucha
                            </span>
                          )}
                        </div>
                        <p className="text-muted text-xs mt-0.5 font-medium">
                          {album.artist_name}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-muted text-xs flex items-center gap-1.5 font-medium">
                        <FontAwesomeIcon icon={faClock} className="text-[10px]" />
                        <span>{formatRelativeDate(entry.listened_at)}</span>
                      </div>
                      {rating !== undefined && (
                        <div className="rating-badge">
                          <FontAwesomeIcon
                            icon={faStar}
                            className="text-xs mr-1"
                          />
                          {rating.toFixed(1)}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar: Stats */}
        <div className="flex flex-col gap-8">
          <div>
            <h2 className="section-title mb-0">Estadísticas</h2>
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="card text-center p-6">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <FontAwesomeIcon
                    icon={faChartLine}
                    className="text-accent-2 text-xs"
                  />
                  <p className="text-teal text-3xl font-bold">{totalRated}</p>
                </div>
                <p className="text-muted text-xs font-medium uppercase tracking-wider">
                  Álbumes
                </p>
              </div>
              <div className="card text-center p-6">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <FontAwesomeIcon icon={faStar} className="text-teal text-xs" />
                  <p className="text-teal text-3xl font-bold">{avgRating}</p>
                </div>
                <p className="text-muted text-xs font-medium uppercase tracking-wider">
                  Promedio
                </p>
              </div>
            </div>
          </div>

          {/* Latest Rated Albums */}
          {totalRated > 0 && (
            <div>
              <h2 className="section-title mb-0">Últimas Calificaciones</h2>
              <div className="flex flex-col gap-3 mt-6">
                {ratings!.slice(0, 5).map((r) => {
                  const album = r.albums as any;
                  if (!album) return null;
                  return (
                    <Link
                      key={r.id}
                      href={`/album/${album.id}`}
                      className="card p-3 flex items-center gap-3 hover:border-teal transition-colors"
                    >
                      <div className="w-10 h-10 bg-[var(--color-surface-alt)] border border-[var(--color-border)] flex items-center justify-center flex-shrink-0 overflow-hidden relative">
                        {album.cover_url ? (
                          <Image
                            src={album.cover_url}
                            alt={album.title}
                            fill
                            sizes="40px"
                            className="object-cover"
                          />
                        ) : (
                          <FontAwesomeIcon
                            icon={faCompactDisc}
                            className="text-accent-2 text-sm"
                          />
                        )}
                      </div>
                      <div className="flex-1 truncate">
                        <p className="text-sm font-semibold text-[var(--color-text)] truncate">
                          {album.title}
                        </p>
                        <p className="text-xs text-muted truncate">
                          {album.artist_name}
                        </p>
                      </div>
                      <div className="rating-badge text-xs">
                        {Number(r.rating).toFixed(1)}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
