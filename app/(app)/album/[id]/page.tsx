import { AlbumCover } from "@/components/AlbumCover";
import { AlbumTopThree } from "@/components/AlbumTopThree";
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
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ profile?: string }>;
}) {
  const { id } = await params;
  const { profile: profileName } = await searchParams;

  const result = await getAlbumWithTracks(id);
  if (!result) notFound();

  const { album, tracks } = result;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profileQuery = supabase.from("profiles").select("id,username,privacy");
  const { data: owner, error: profileError } = profileName
    ? await profileQuery.eq("username", profileName).maybeSingle()
    : user ? await profileQuery.eq("id", user.id).maybeSingle() : { data: null, error: null };
  if (profileError) throw profileError;
  if (!owner || (owner.privacy !== "public" && owner.id !== user?.id)) notFound();
  const isOwner = owner.id === user?.id;
  const ownerLabel = `@${owner.username}`;
  const trackIds = tracks.map(track => track.id);
  const [reviewResult, topResult] = await Promise.all([
    supabase.from("song_reviews").select("id,track_id,content").eq("user_id", owner.id).in("track_id", trackIds),
    supabase.from("album_top_three").select("first_track_id,second_track_id,third_track_id").eq("user_id", owner.id).eq("album_id", album.id).maybeSingle(),
  ]);
  const missingTable = (error: { code: string } | null) => error && ["42P01", "PGRST205"].includes(error.code);
  if (reviewResult.error && !missingTable(reviewResult.error)) throw reviewResult.error;
  if (topResult.error && !missingTable(topResult.error)) throw topResult.error;
  const reviews: Record<string, { id: string | null; content: string }> = {};
  for (const row of reviewResult.data || []) reviews[row.track_id] = { id: row.id, content: row.content };
  if (missingTable(reviewResult.error)) {
    const { data: legacy, error } = await supabase.from("track_comments").select("track_id,content").eq("user_id", owner.id).in("track_id", trackIds);
    if (error) throw error;
    for (const row of legacy || []) reviews[row.track_id] = { id: null, content: row.content };
  }
  const top = topResult.data;

  const { data: group } = await supabase.from("album_groups").select("release_group_id").eq("album_id",album.id).limit(1).maybeSingle();

  // Fetch user's album rating
  const { data: userRating } = owner
    ? await supabase
        .from("album_ratings")
        .select("id, rating, review")
        .eq("user_id", owner.id)
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
  const { data: allTrackRatings } = owner
    ? await supabase
        .from("track_ratings")
        .select("track_id, rating")
        .eq("user_id", owner.id)
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
      {profileName && <p className="text-sm text-muted my-4">Reseña de <Link className="text-teal" href={`/profile/${owner.username}`}>{ownerLabel}</Link>{!isOwner && user && <> · <Link className="text-teal underline" href={`/album/${id}`}>Ver mi valoración</Link></>}</p>}

      {/* Album Header */}
      <div className="card p-4 sm:p-6 mb-8 overflow-hidden">
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-center sm:items-start">
          {/* Cover */}
          <div className="w-32 h-32 sm:w-48 sm:h-48 bg-[var(--color-surface-alt)] border border-[var(--color-border)] flex items-center justify-center relative flex-shrink-0 overflow-hidden">
            <AlbumCover key={album.id} album={{ mbid: album.external_id.replace(/^itunes:/, ""), entityType: album.external_id.startsWith("itunes:") ? "itunes" : "release", title: album.title, coverUrl: album.cover_url }} sizes="(max-width: 640px) 128px, 192px" priority />
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
                    {isOwner ? "Mi reseña:" : `Reseña de ${ownerLabel}:`}
                  </p>
                  <p className="text-sm text-[var(--color-text)] italic font-medium">
                    &ldquo;{userRating.review}&rdquo;
                  </p>
                </div>
              )}
            </div>

            <p className="text-muted text-xs mt-4">{tracks.length} canciones · {album.external_id.startsWith("itunes:") ? "Edición digital de iTunes" : "Edición de MusicBrainz"}</p>
            {!album.external_id.startsWith("itunes:") && <p className="text-muted text-xs mt-2">¿La portada o las canciones no coinciden con la versión que escuchaste? <Link className="text-teal underline" href={`/search?q=${encodeURIComponent(album.title + " " + album.artist_name)}&source=itunes`}>Buscar la edición digital</Link>. Tus notas se conservan en esta edición.</p>}
            <ItunesBadge id={album.artwork_itunes_id} coverUrl={album.cover_url} />
            {/* Actions */}
            {isOwner && <div className="mt-6" id="album-rating">
              <AlbumActions
                albumId={album.id}
                saveReference={{mbid:group?.release_group_id || (album.external_id.startsWith("itunes:") ? album.external_id.slice(7) : album.external_id),entityType:group ? "release-group" : album.external_id.startsWith("itunes:") ? "itunes" : "release",title:album.title,artist:album.artist_name,coverUrl:album.cover_url || undefined,year:album.release_date || undefined}}
                existingRating={userRating ? Number(userRating.rating) : null}
                existingReview={userRating?.review || null}
                deleteRatingId={userRating?.id}
              />
            </div>}
          </div>
        </div>
      </div>

      <AlbumTopThree key={`${owner.id}:${album.id}`} albumId={album.id} userId={owner.id} tracks={tracks} initialTrackIds={top ? [top.first_track_id, top.second_track_id, top.third_track_id] : []} editable={isOwner} ownerLabel={ownerLabel} databaseReady={!topResult.error} />
      <TrackList key={`${owner.id}:${album.id}`} tracks={tracks} initialTrackRatings={trackRatingMap} isOwner={isOwner} hasAlbumRating={!!userRating} reviews={reviews} currentUserId={user?.id ?? null} ownerLabel={ownerLabel} databaseReady={!reviewResult.error} />
      {profileName && userRating && <ReviewComments ratingId={userRating.id} currentUserId={user?.id ?? null} />}

      {/* Community Reviews */}
      {!profileName && visibleReviews.length > 0 && (
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


    </div>
  );
}
