import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar, faGlobe, faLock, faCrown } from "@fortawesome/free-solid-svg-icons";
import { createClient } from "@/lib/supabase/server";
import { PrivacyToggle } from "@/components/PrivacyToggle";
import { UsernameEditor } from "@/components/UsernameEditor";
import { AvatarEditor } from "@/components/AvatarEditor";
import { BioEditor } from "@/components/BioEditor";
import { SocialEditor } from "@/components/SocialEditor";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();

  // Fetch profile by username
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .single();

  if (!profile) notFound();

  // Check if this is the current user's profile
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwnProfile = user?.id === profile.id;

  // If profile is private and not own, show restricted view
  if (profile.privacy === "private" && !isOwnProfile) {
    return (
      <div className="page-container py-4 flex-1 w-full max-w-4xl">
        <div className="card p-12 text-center">
          <FontAwesomeIcon icon={faLock} className="text-muted text-3xl mb-4" />
          <h1 className="font-display text-teal text-2xl mb-2">
            Perfil privado
          </h1>
          <p className="text-muted text-sm">
            Este usuario ha configurado su perfil como privado.
          </p>
        </div>
      </div>
    );
  }

  // Fetch rated albums
  const { data: ratings } = await supabase
    .from("album_ratings")
    .select("id, rating, album_id, albums(id, title, artist_name, cover_url)")
    .eq("user_id", profile.id)
    .order("updated_at", { ascending: false });

  const totalRated = ratings?.length || 0;
  const avgRating =
    totalRated > 0
      ? (
          ratings!.reduce((sum, r) => sum + Number(r.rating), 0) / totalRated
        ).toFixed(1)
      : "—";

  return (
    <div className="page-container py-4 flex-1 w-full">
      {/* Profile Header */}
      <div className="card mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Avatar */}
            {isOwnProfile ? (
              <AvatarEditor
                currentUrl={profile.avatar_url}
                displayName={profile.display_name || profile.username}
              />
            ) : (
              <div className="w-20 h-20 border-2 border-teal overflow-hidden relative flex-shrink-0 bg-[var(--color-surface-alt)]">
                {profile.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt={profile.display_name || profile.username}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-teal font-bold text-2xl">
                    {(profile.display_name || profile.username).charAt(0)}
                  </div>
                )}
              </div>
            )}

            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-display text-2xl md:text-3xl text-teal">
                  {profile.display_name || profile.username}
                </h1>
                {profile.is_admin && (
                  <span className="inline-flex items-center gap-1 bg-teal/20 text-teal text-xs font-bold px-2 py-0.5 border border-teal/30">
                    <FontAwesomeIcon icon={faCrown} className="text-[10px]" />
                    Creador
                  </span>
                )}
                <span className="badge-accent flex items-center gap-1">
                  <FontAwesomeIcon
                    icon={profile.privacy === "public" ? faGlobe : faLock}
                    className="text-[10px]"
                  />
                  {profile.privacy === "public" ? "Público" : "Privado"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-muted text-sm font-medium">
                  @{profile.username}
                </p>
                {isOwnProfile && (
                  <UsernameEditor currentUsername={profile.username} />
                )}
              </div>
              {isOwnProfile ? (
                <BioEditor currentBio={profile.bio} />
              ) : profile.bio ? (
                <p className="text-[var(--color-text)] text-sm mt-2">
                  {profile.bio}
                </p>
              ) : null}
              <SocialEditor
                websiteUrl={profile.website_url}
                instagramUrl={profile.instagram_url}
                twitterUrl={profile.twitter_url}
                facebookUrl={profile.facebook_url}
              />
            </div>
          </div>

          {/* Stats + Privacy Toggle */}
          <div className="flex flex-col items-end gap-4">
            {isOwnProfile && <PrivacyToggle currentPrivacy={profile.privacy} />}
            <div className="card-alt flex items-center gap-8 justify-center">
              <div className="text-center">
                <p className="text-teal text-2xl font-bold">{totalRated}</p>
                <p className="text-muted text-xs uppercase font-medium">
                  Álbumes
                </p>
              </div>
              <div className="w-[1px] h-8 bg-[var(--color-border)]" />
              <div className="text-center">
                <p className="text-teal text-2xl font-bold">{avgRating}</p>
                <p className="text-muted text-xs uppercase font-medium">
                  Promedio
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rated Albums */}
      <h2 className="section-title">Álbumes Calificados</h2>

      {totalRated === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-muted text-sm">
            {isOwnProfile
              ? "Aún no has calificado ningún álbum."
              : "Este usuario aún no ha calificado ningún álbum."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {ratings!.map((r) => {
            const album = r.albums as any;
            if (!album) return null;
            return (
              <Link
                key={r.id}
                href={`/album/${album.id}`}
                className="card-album group"
              >
                <div className="w-full aspect-square bg-[var(--color-surface-alt)] flex items-center justify-center relative border-b border-[var(--color-border)] overflow-hidden">
                  {album.cover_url ? (
                    <Image
                      src={album.cover_url}
                      alt={album.title}
                      fill
                      sizes="(max-width: 768px) 50vw, 25vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 relative opacity-40">
                      <Image
                        src="/assets/icon-blue.png"
                        alt=""
                        fill
                        sizes="64px"
                        className="object-contain"
                      />
                    </div>
                  )}
                  <div className="absolute bottom-2 right-2 rating-badge">
                    <FontAwesomeIcon icon={faStar} className="text-xs mr-1" />
                    {Number(r.rating).toFixed(1)}
                  </div>
                </div>
                <div className="p-4">
                  <p className="font-display font-semibold text-[var(--color-text)] text-base truncate">
                    {album.title}
                  </p>
                  <p className="text-muted text-xs truncate mt-0.5 font-medium">
                    {album.artist_name}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
