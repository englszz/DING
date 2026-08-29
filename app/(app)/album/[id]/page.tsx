import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar, faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { createClient } from "@/lib/supabase/server";
import { getAlbumWithTracks } from "@/lib/supabase/queries";
import { AlbumActions } from "@/components/AlbumActions";
import { TrackList } from "@/components/TrackList";

export default async function AlbumDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const result = await getAlbumWithTracks(id);
  if (!result) notFound();

  const { album, tracks } = result;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch user's album rating
  const { data: userRating } = user
    ? await supabase
        .from("album_ratings")
        .select("id, rating, review")
        .eq("user_id", user.id)
        .eq("album_id", album.id)
        .single()
    : { data: null };

  // Fetch track ratings from track_ratings table
  const { data: allTrackRatings } = user
    ? await supabase
        .from("track_ratings")
        .select("track_id, rating")
        .eq("user_id", user.id)
        .in(
          "track_id",
          tracks.map((t) => t.id)
        )
    : { data: null };

  const trackRatingMap: Record<string, number> = {};
  (allTrackRatings || []).forEach((tr) => {
    trackRatingMap[tr.track_id] = Number(tr.rating);
  });

  return (
    <div className="page-container py-4 flex-1 w-full max-w-4xl">
      {/* Back link */}
      <Link
        href="/search"
        className="inline-flex items-center gap-2 text-muted text-sm mb-6 hover:text-teal transition-colors"
      >
        <FontAwesomeIcon icon={faArrowLeft} className="text-xs" />
        <span>Volver al buscador</span>
      </Link>

      {/* Album Header */}
      <div className="card p-4 sm:p-6 mb-8 overflow-hidden">
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-center sm:items-start">
          {/* Cover */}
          <div className="w-32 h-32 sm:w-48 sm:h-48 bg-[var(--color-surface-alt)] border border-[var(--color-border)] flex items-center justify-center relative flex-shrink-0 overflow-hidden">
            {album.cover_url ? (
              <Image
                src={album.cover_url}
                alt={album.title}
                fill
                sizes="(max-width: 640px) 128px, 192px"
                priority
                className="object-cover"
              />
            ) : (
              <FontAwesomeIcon
                icon={faStar}
                className="text-teal text-4xl opacity-30"
              />
            )}
            {userRating && (
              <div className="absolute bottom-2 right-2 rating-badge text-xs">
                <FontAwesomeIcon icon={faStar} className="text-[10px] mr-1" />
                {Number(userRating.rating).toFixed(1)}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0 w-full">
            <div>
              <h1 className="font-display text-xl sm:text-3xl md:text-4xl text-teal mb-1 break-words">
                {album.title}
              </h1>
              <p className="text-sm sm:text-lg font-bold text-[var(--color-text)] truncate">
                {album.artist_name}
              </p>
              <p className="text-muted text-sm mt-1 font-medium">
                {album.release_date || "Año desconocido"}
              </p>

              {userRating?.review && (
                <div className="card-alt mt-4 p-4 border border-[var(--color-border)]">
                  <p className="text-xs font-semibold text-muted mb-1 uppercase tracking-wider">
                    Mi Reseña:
                  </p>
                  <p className="text-sm text-[var(--color-text)] italic font-medium">
                    &ldquo;{userRating.review}&rdquo;
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-6">
              <AlbumActions
                albumId={album.id}
                existingRating={userRating ? Number(userRating.rating) : null}
                existingReview={userRating?.review || null}
                deleteRatingId={userRating?.id}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tracklist with pie chart (client component for live updates) */}
      <TrackList
        tracks={tracks}
        initialTrackRatings={trackRatingMap}
        isOwner={!!user}
      />
    </div>
  );
}
