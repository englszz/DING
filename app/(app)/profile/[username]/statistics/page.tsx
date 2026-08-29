import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faStar,
  faCompactDisc,
  faHeadphones,
  faArrowTrendUp,
  faArrowTrendDown,
  faLock,
  faMagnifyingGlass,
} from "@fortawesome/free-solid-svg-icons";
import { createClient } from "@/lib/supabase/server";

export default async function StatisticsPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .single();

  if (!profile) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwnProfile = user?.id === profile.id;

  if (profile.privacy === "private" && !isOwnProfile) {
    return (
      <div className="page-container py-4 flex-1 w-full max-w-4xl">
        <div className="card p-12 text-center">
          <FontAwesomeIcon icon={faLock} className="text-muted text-3xl mb-4" />
          <h1 className="font-display text-teal text-2xl mb-2">
            Estadísticas privadas
          </h1>
          <p className="text-muted text-sm">
            Este usuario ha configurado su perfil como privado.
          </p>
        </div>
      </div>
    );
  }

  const [ratings, listens, trackRates] = await Promise.all([
    supabase
      .from("album_ratings")
      .select("id, rating, created_at, albums(id, title, artist_name, cover_url)")
      .eq("user_id", profile.id),
    supabase
      .from("listen_log")
      .select("id, listened_at")
      .eq("user_id", profile.id),
    supabase
      .from("track_ratings")
      .select("id, rating")
      .eq("user_id", profile.id),
  ]);

  const r = ratings.data || [];
  const l = listens.data || [];
  const tr = trackRates.data || [];

  const totalRated = r.length;
  const totalListens = l.length;
  const totalTrackRates = tr.length;

  const avg =
    totalRated > 0
      ? (r.reduce((s, x) => s + Number(x.rating), 0) / totalRated).toFixed(1)
      : "—";

  const ratingValues = r.map((x) => Number(x.rating));

  const buckets = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((b) =>
    ratingValues.filter((v) => v >= b && v < b + 1).length
  );

  const maxBucket = Math.max(1, ...buckets);

  const highest = totalRated
    ? [...r].sort((a, b) => Number(b.rating) - Number(a.rating))[0]
    : null;
  const lowest = totalRated
    ? [...r].sort((a, b) => Number(a.rating) - Number(b.rating))[0]
    : null;

  const months: Record<string, number> = {};
  r.forEach((x) => {
    const key = new Date(x.created_at).toLocaleDateString("es-ES", {
      month: "short",
      year: "numeric",
    });
    months[key] = (months[key] || 0) + 1;
  });
  const monthEntries = Object.entries(months);
  const maxMonth = Math.max(1, ...monthEntries.map(([, c]) => c));

  return (
    <div className="page-container py-4 flex-1 w-full">
      <Link
        href={`/profile/${username}`}
        className="text-muted hover:text-teal text-sm font-medium transition-colors inline-flex items-center gap-2 mb-6"
      >
        <FontAwesomeIcon icon={faCompactDisc} className="text-xs" />
        ← Volver a @{username}
      </Link>

      <h1 className="font-display text-teal text-3xl mb-8">
        Estadísticas de @{username}
      </h1>

      {/* Empty state CTA */}
      {totalRated === 0 && totalListens === 0 && totalTrackRates === 0 && (
        <div className="card p-12 text-center flex flex-col items-center justify-center mb-8">
          <FontAwesomeIcon
            icon={faCompactDisc}
            className="text-muted text-4xl mb-4 opacity-30"
          />
          <p className="text-[var(--color-text)] font-bold mb-2">
            Aún no tienes estadísticas
          </p>
          <p className="text-muted text-sm mb-6 max-w-md">
            Escucha álbumes y reseñálos para ver tus estadísticas aquí.
          </p>
          <Link href="/search" className="btn btn-primary text-xs">
            <FontAwesomeIcon icon={faMagnifyingGlass} />
            <span>Buscar álbumes</span>
          </Link>
        </div>
      )}

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="card p-4 text-center">
          <FontAwesomeIcon icon={faCompactDisc} className="text-teal text-lg mb-2" />
          <p className="text-teal text-3xl font-bold">{totalRated}</p>
          <p className="text-muted text-xs uppercase font-medium">Álbumes</p>
        </div>
        <div className="card p-4 text-center">
          <FontAwesomeIcon icon={faHeadphones} className="text-teal text-lg mb-2" />
          <p className="text-teal text-3xl font-bold">{totalListens}</p>
          <p className="text-muted text-xs uppercase font-medium">Escuchas</p>
        </div>
        <div className="card p-4 text-center">
          <FontAwesomeIcon icon={faStar} className="text-teal text-lg mb-2" />
          <p className="text-teal text-3xl font-bold">{avg}</p>
          <p className="text-muted text-xs uppercase font-medium">Promedio</p>
        </div>
        <div className="card p-4 text-center">
          <FontAwesomeIcon icon={faStar} className="text-teal text-lg mb-2" />
          <p className="text-teal text-3xl font-bold">{totalTrackRates}</p>
          <p className="text-muted text-xs uppercase font-medium">Tracks</p>
        </div>
      </div>

      {/* Rating distribution histogram */}
      <div className="card mb-8">
        <h2 className="font-bold text-[var(--color-text)] mb-4">
          Distribución de calificaciones
        </h2>
        <div className="flex items-end gap-1 sm:gap-2 h-48">
          {buckets.map((count, b) => (
            <div key={b} className="flex-1 flex flex-col items-center justify-end h-full">
              <span className="text-xs text-muted mb-1">{count}</span>
              <div
                className="w-full bg-teal transition-all"
                style={{
                  height: `${(count / maxBucket) * 100}%`,
                  minHeight: `${count > 0 ? 6 : 2}px`,
                  opacity: 0.85,
                }}
              />
              <span className="text-xs text-muted mt-1">{b}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Highest / lowest */}
      {highest && lowest && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="card">
            <h2 className="font-bold text-[var(--color-text)] mb-4 flex items-center gap-2">
              <FontAwesomeIcon icon={faArrowTrendUp} className="text-teal" />
              Mejor calificado
            </h2>
            {(() => {
              const a = highest.albums as any;
              return (
                <Link href={`/album/${a.id}`} className="flex items-center gap-4 group">
                  <div className="w-16 h-16 relative overflow-hidden flex-shrink-0 bg-[var(--color-surface-alt)] border border-[var(--color-border)]">
                    {a.cover_url && (
                      <Image src={a.cover_url} alt={a.title} fill sizes="64px" className="object-cover" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-display font-semibold text-[var(--color-text)] truncate">
                      {a.title}
                    </p>
                    <p className="text-muted text-xs truncate">{a.artist_name}</p>
                    <p className="rating-badge mt-1">
                      <FontAwesomeIcon icon={faStar} className="text-xs mr-1" />
                      {Number(highest.rating).toFixed(1)}
                    </p>
                  </div>
                </Link>
              );
            })()}
          </div>
          <div className="card">
            <h2 className="font-bold text-[var(--color-text)] mb-4 flex items-center gap-2">
              <FontAwesomeIcon icon={faArrowTrendDown} className="text-red-500" />
              Menor calificado
            </h2>
            {(() => {
              const a = lowest.albums as any;
              return (
                <Link href={`/album/${a.id}`} className="flex items-center gap-4 group">
                  <div className="w-16 h-16 relative overflow-hidden flex-shrink-0 bg-[var(--color-surface-alt)] border border-[var(--color-border)]">
                    {a.cover_url && (
                      <Image src={a.cover_url} alt={a.title} fill sizes="64px" className="object-cover" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-display font-semibold text-[var(--color-text)] truncate">
                      {a.title}
                    </p>
                    <p className="text-muted text-xs truncate">{a.artist_name}</p>
                    <p className="rating-badge mt-1">
                      <FontAwesomeIcon icon={faStar} className="text-xs mr-1" />
                      {Number(lowest.rating).toFixed(1)}
                    </p>
                  </div>
                </Link>
              );
            })()}
          </div>
        </div>
      )}

      {/* Activity over time */}
      {monthEntries.length > 0 && (
        <div className="card">
          <h2 className="font-bold text-[var(--color-text)] mb-4">
            Actividad en el tiempo
          </h2>
          <div className="flex items-end gap-2 h-40">
            {monthEntries.map(([label, count]) => (
              <div key={label} className="flex-1 flex flex-col items-center justify-end h-full">
                <span className="text-xs text-muted mb-1">{count}</span>
                <div
                  className="w-full bg-accent-2 transition-all"
                  style={{ height: `${(count / maxMonth) * 100}%`, minHeight: "2px", opacity: 0.85 }}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            {monthEntries.map(([label]) => (
              <span key={label} className="flex-1 text-center text-[10px] text-muted truncate">
                {label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
