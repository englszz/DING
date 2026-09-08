import { normalize } from "@/lib/musicbrainz/search";
import { itunesAlbum, searchItunesAlbums } from "@/lib/itunes/api";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAlbumDetails, getGroupEditions } from "@/lib/musicbrainz/api";

export const maxDuration = 60;
const schema = z.object({
  title: z.string().min(1).max(500).optional(),
  artist: z.string().min(1).max(500).optional(),
  year: z.string().max(20).optional(),
  mbid: z.string().min(1).max(50),
  entityType: z.enum(["release", "release-group", "itunes"]).default("release"),
});

export async function POST(request: Request) {
  const started = Date.now();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json(
      { error: "Inicia sesión para abrir el álbum." },
      { status: 401 },
    );
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Referencia de álbum inválida." },
      { status: 400 },
    );
  const { mbid, entityType, title, artist, year } = parsed.data;
  const signal = AbortSignal.any([
    request.signal,
    AbortSignal.timeout(title && artist ? 8000 : 45000),
  ]);
  if (
    entityType === "itunes"
      ? !/^[0-9]{1,20}$/.test(mbid)
      : !z.string().uuid().safeParse(mbid).success
  )
    return NextResponse.json({ error: "Referencia inválida" }, { status: 400 });
  const key = `${entityType}:${mbid}`;
  let token: string | null = null;
  async function openItunes(id: string) {
    const { data: ref, error } = await supabase
      .from("album_external_refs")
      .select("album_id")
      .eq("entity_type", "itunes")
      .eq("external_id", id)
      .maybeSingle();
    if (error) throw error;
    if (ref) return ref.album_id as string;
    const details = await itunesAlbum(id);
    const result = await supabase.rpc("ding_import_itunes", {
      p_external_id: id,
      p_details: details,
    });
    if (result.error) throw result.error;
    return result.data as string;
  }
  try {
    if (entityType === "itunes")
      return NextResponse.json({ albumId: await openItunes(mbid) });
    let releaseId = mbid;
    if (entityType === "release-group") {
      const { data: mapping, error } = await supabase
        .from("album_groups")
        .select("album_id, albums(id, external_id, tracks(id))")
        .eq("release_group_id", mbid)
        .maybeSingle();
      if (error) throw error;
      const album = Array.isArray(mapping?.albums)
        ? mapping.albums[0]
        : mapping?.albums;
      if (album?.tracks?.length)
        return NextResponse.json({ albumId: album.id });
      if (album) releaseId = album.external_id;
    } else {
      const { data: album, error } = await supabase
        .from("albums")
        .select("id, tracks(id)")
        .eq("external_id", mbid)
        .maybeSingle();
      if (error) throw error;
      if (album?.tracks?.length)
        return NextResponse.json({ albumId: album.id });
    }
    const claim = await supabase.rpc("ding_claim_import", { p_key: key });
    if (claim.error) throw claim.error;
    token = claim.data;
    if (!token)
      return NextResponse.json(
        { error: "Este álbum se está preparando. Espera un momento." },
        { status: 409, headers: { "Retry-After": "2" } },
      );
    if (entityType === "release-group" && releaseId === mbid) {
      const editions = await getGroupEditions(mbid, signal);
      let matched = false;
      for (let offset = 0; offset < editions.length; offset += 100) {
        const { data: saved, error } = await supabase
          .from("albums")
          .select("id, external_id, tracks(id)")
          .in(
            "external_id",
            editions.slice(offset, offset + 100).map((item) => item.id),
          )
          .order("created_at")
          .limit(1);
        if (error) throw error;
        if (saved?.[0]) {
          releaseId = saved[0].external_id;
          matched = true;
          if (saved[0].tracks?.length) {
            const result = await supabase.rpc("ding_finish_import", {
              p_key: key,
              p_token: token,
              p_release_id: releaseId,
              p_group_id: mbid,
              p_details: null,
            });
            if (result.error) throw result.error;
            return NextResponse.json({ albumId: result.data });
          }
          break;
        }
      }
      if (!matched) {
        const edition = editions.find((item) => item.status === "Official");
        if (!edition)
          return NextResponse.json(
            { error: "No encontramos una edición oficial." },
            { status: 404 },
          );
        releaseId = edition.id;
      }
    }
    const details = await getAlbumDetails(releaseId, signal);
    if (!details?.tracks?.length)
      return NextResponse.json(
        {
          error:
            "El servicio musical no devolvió las canciones. Inténtalo de nuevo.",
        },
        { status: 502 },
      );
    const result = await supabase.rpc("ding_finish_import", {
      p_key: key,
      p_token: token,
      p_release_id: releaseId,
      p_group_id: entityType === "release-group" ? mbid : null,
      p_details: details,
    });
    if (result.error) throw result.error;
    return NextResponse.json({ albumId: result.data });
  } catch (error) {
    if (error instanceof Error && error.name === "IncompleteItunesAlbumError") {
      console.warn("album_import_incomplete", { entityType, elapsedMs: Date.now() - started });
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (
      entityType === "release-group" &&
      title &&
      artist &&
      !request.signal.aborted &&
      error instanceof Error
    ) {
      try {
        const candidates = (
          await searchItunesAlbums(title + " " + artist, "all")
        ).filter(
          (a) =>
            normalize(a.title) === normalize(title) &&
            normalize(a.artist) === normalize(artist) &&
            (!year || a.year === year),
        );
        if (candidates.length === 1) {
          const candidate = candidates[0];
          const albumId = await openItunes(candidate.mbid);
          // Transfer only this viewer's pending save, never invent a MusicBrainz alias.
          const saved = await supabase
            .from("saved_albums")
            .select("external_id")
            .eq("user_id", user.id)
            .eq("external_id", mbid)
            .eq("entity_type", entityType)
            .maybeSingle();
          if (saved.data) {
            const moved = await supabase.rpc("ding_save_album", {
              p_external_id: candidate.mbid,
              p_entity_type: "itunes",
              p_title: candidate.title,
              p_artist: candidate.artist,
              p_year: candidate.year || null,
            });
            if (!moved.error)
              await supabase
                .from("saved_albums")
                .delete()
                .eq("user_id", user.id)
                .eq("external_id", mbid)
                .eq("entity_type", entityType);
          }
          console.info("album_import_backup", { provider: "itunes" });
          return NextResponse.json({ albumId });
        }
      } catch {
        console.warn("album_import_backup_failed");
      }
    }
    console.error("album_import_failed", {
      elapsedMs: Date.now() - started,
      entityType,
      error,
    });
    return NextResponse.json(
      {
        error:
          "No pudimos preparar el álbum. El servicio puede estar ocupado; inténtalo de nuevo.",
      },
      { status: 503 },
    );
  } finally {
    console.info("album_import", {
      entityType,
      durationMs: Date.now() - started,
    });
    if (token) {
      try {
        await supabase.rpc("ding_release_import", {
          p_key: key,
          p_token: token,
        });
      } catch {
        console.warn("album_import_lease_cleanup_failed");
      }
    }
  }
}
