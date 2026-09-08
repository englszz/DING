import { ItunesBadge } from "@/components/ItunesBadge";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar } from "@fortawesome/free-solid-svg-icons";
import { createClient } from "@/lib/supabase/server";
import { getAlbumWithTracks } from "@/lib/supabase/queries";
import { AlbumActions } from "@/components/AlbumActions";
import { TrackList } from "@/components/TrackList";
import { BackButton } from "@/components/BackButton";
import { ReviewComments } from "@/components/ReviewComments";

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

  const { data: group } = await supabase.from("album_groups").select("release_group_id").eq("album_id",album.id).limit(1).maybeSingle();

  // Fetch user's album rating
  const { data: userRating } = user
    ? await supabase
        .from("album_ratings")
        .select("id, rating, review")
        .eq("user_id", user.id)
        .eq("album_id", album.id)
        .single()
    : { data: null };

  // Fetch all ratings for this album (community reviews)
  const { data: communityRatings } = await supabase
    .from("album_ratings")
    .select(
      "id, rating, review, created_at, profiles(id, username, display_name, avatar_url, privacy)"
    )
    .eq("album_id", album.id)
    .order("updated_at", { ascending: false });

  // Only show reviews from public profiles (plus the viewer's own)
  const visibleReviews = (communityRatings || []).filter((r) => {
    const p: any = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return p && (p.privacy === "public" || p.id === user?.id);
  });

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
      <BackButton label="Volver" />

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

            <ItunesBadge id={album.artwork_itunes_id} coverUrl={album.cover_url} />
            {/* Actions */}
            <div className="mt-6">
              <AlbumActions
                albumId={album.id}
                saveReference={{mbid:group?.release_group_id || (album.external_id.startsWith("itunes:") ? album.external_id.slice(7) : album.external_id),entityType:group ? "release-group" : album.external_id.startsWith("itunes:") ? "itunes" : "release",title:album.title,artist:album.artist_name,coverUrl:album.cover_url || undefined,year:album.release_date || undefined}}
                existingRating={userRating ? Number(userRating.rating) : null}
                existingReview={userRating?.review || null}
                deleteRatingId={userRating?.id}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Community Reviews */}
      {visibleReviews.length > 0 && (
        <>
          <h2 className="section-title" style={{ marginBottom: "28px" }}>
            Calificaciones de la comunidad
          </h2>
          <div className="flex flex-col gap-7 mb-12">
            {visibleReviews.map((r) => {
              const p: any = Array.isArray(r.profiles)
                ? r.profiles[0]
                : r.profiles;
              if (!p) return null;
              return (
                <div key={r.id} className="card p-5 sm:p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[var(--color-surface-alt)] border border-[var(--color-border)] overflow-hidden relative flex-shrink-0">
                      {p.avatar_url ? (
                        <Image
                          src={p.avatar_url}
                          alt={p.display_name || p.username}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-teal font-bold text-lg">
                          {(p.display_name || p.username || "?").charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/profile/${p.username}`}
                        className="text-sm font-bold text-[var(--color-text)] hover:text-teal transition-colors truncate block"
                      >
                        {p.display_name || p.username}
                      </Link>
                      <p className="text-muted text-xs text-teal mt-1 leading-relaxed">
                        @{p.username}
                      </p>
                    </div>
                    <div className="rating-badge flex-shrink-0">
                      <FontAwesomeIcon icon={faStar} className="text-xs mr-1" />
                      {Number(r.rating).toFixed(1)}
                    </div>
                  </div>
                  {r.review && (
                    <p className="text-sm sm:text-base text-[var(--color-text)] mt-5 italic font-medium leading-relaxed">
                      &ldquo;{r.review}&rdquo;
                    </p>
                  )}

                  <ReviewComments
                    ratingId={r.id}
                    currentUserId={user?.id ?? null}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Tracklist with pie chart (client component for live updates) */}
      <TrackList
        tracks={tracks}
        initialTrackRatings={trackRatingMap}
        isOwner={!!user}
      />
    </div>
  );
}
