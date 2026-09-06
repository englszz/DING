"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faComment,
  faReply,
  faTrash,
  faSpinner,
  faPaperPlane,
  faX,
} from "@fortawesome/free-solid-svg-icons";
import { createClient } from "@/lib/supabase/client";
import {
  addReviewComment,
  deleteReviewComment,
} from "@/app/(app)/album/actions";

type CommentRow = {
  id: string;
  content: string;
  created_at: string;
  parent_id: string | null;
  profiles: any;
};

function normalizeProfile(p: any) {
  if (!p) return null;
  return Array.isArray(p) ? p[0] : p;
}

function Avatar({ profile, size = 36 }: { profile: any; size?: number }) {
  if (!profile) return null;
  const initial = (profile.display_name || profile.username || "?").charAt(0);
  return (
    <div
      className="bg-[var(--color-surface-alt)] border border-[var(--color-border)] overflow-hidden relative flex-shrink-0"
      style={{ width: size, height: size }}
    >
      {profile.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.avatar_url}
          alt={profile.username}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center text-teal font-bold text-xs"
          style={{ fontSize: size * 0.4 }}
        >
          {initial}
        </div>
      )}
    </div>
  );
}

export function ReviewComments({
  ratingId,
  currentUserId,
}: {
  ratingId: string;
  currentUserId?: string | null;
}) {
  const [rows, setRows] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [replyParentId, setReplyParentId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorReply, setErrorReply] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("review_comments")
      .select(
        "id, content, created_at, parent_id, profiles(id, username, display_name, avatar_url, privacy)"
      )
      .eq("album_rating_id", ratingId)
      .order("created_at", { ascending: true });
    setRows((data || []) as CommentRow[]);
    return (data || []) as CommentRow[];
  }, [ratingId]);

  useEffect(() => {
    let active = true;
    async function load() {
      const data = await loadComments();
      if (active) setLoading(false);
      return data;
    }
    load();
    return () => {
      active = false;
    };
  }, [loadComments]);

  // Group replies under their top-level comment
  const { topLevel, repliesByParent } = useMemo(() => {
    const topLevel: CommentRow[] = [];
    const repliesByParent: Record<string, CommentRow[]> = {};
    for (const c of rows) {
      if (!c.parent_id) {
        topLevel.push(c);
      } else {
        const anchor = c.parent_id;
        (repliesByParent[anchor] = repliesByParent[anchor] || []).push(c);
      }
    }
    return { topLevel, repliesByParent };
  }, [rows]);

  // Visible comments: public profiles + own
  function isVisible(profile: any) {
    if (!profile) return false;
    return profile.privacy === "public" || profile.id === currentUserId;
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("es", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  async function handleSubmit() {
    const trimmed = commentText.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    try {
      await addReviewComment(ratingId, trimmed, null);
      setCommentText("");
      await loadComments();
    } catch (e: any) {
      setError(e.message || "Error al enviar el comentario");
    }
    setSubmitting(false);
  }

  async function handleReply(parentId: string) {
    const trimmed = replyText.trim();
    if (!trimmed) return;
    setSubmittingReply(true);
    setErrorReply(null);
    try {
      await addReviewComment(ratingId, trimmed, parentId);
      setReplyText("");
      setReplyParentId(null);
      await loadComments();
    } catch (e: any) {
      setErrorReply(e.message || "Error al enviar la respuesta");
    }
    setSubmittingReply(false);
  }

  async function handleDelete(commentId: string) {
    setError(null);
    try {
      await deleteReviewComment(commentId);
      await loadComments();
    } catch (e: any) {
      setError(e.message || "Error al eliminar el comentario");
    }
  }

  if (loading) {
    return (
      <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
        <p className="text-muted text-xs">
          <FontAwesomeIcon icon={faSpinner} spin className="mr-1" /> Cargando
          comentarios...
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 pt-6 border-t border-[var(--color-border)]">
      <p className="text-sm font-semibold text-muted uppercase tracking-wider mb-6">
        <FontAwesomeIcon icon={faComment} className="mr-1.5" />
        Comentarios ({rows.length})
      </p>

      {/* Comment list */}
      {rows.length === 0 ? (
        <p className="text-muted text-sm mb-5">
          Sé el primero en comentar esta reseña.
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {topLevel.map((c) => {
            const p = normalizeProfile(c.profiles);
            if (!isVisible(p)) return null;
            const replies = (repliesByParent[c.id] || []).filter((r) =>
              isVisible(normalizeProfile(r.profiles))
            );
            const isOwn = p.id === currentUserId;
            return (
              <div key={c.id} className="flex gap-4">
                <Avatar profile={p} size={40} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <Link
                      href={`/profile/${p.username}`}
                      className="text-sm font-bold text-[var(--color-text)] hover:text-teal transition-colors"
                    >
                      {p.display_name || p.username}
                    </Link>
                    <span className="text-muted text-xs">
                      {formatDate(c.created_at)}
                    </span>
                  </div>
                  <p className="text-sm sm:text-base text-[var(--color-text)] mt-2 leading-relaxed">
                    {c.content}
                  </p>
                  <div className="flex items-center gap-5 mt-3">
                    <button
                      type="button"
                      onClick={() =>
                        setReplyParentId(
                          replyParentId === c.id ? null : c.id
                        )
                      }
                      className="text-teal text-xs font-bold hover:opacity-80 transition-opacity"
                    >
                      <FontAwesomeIcon icon={faReply} className="mr-1.5" />
                      Responder
                    </button>
                    {isOwn && (
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id)}
                        className="text-muted text-xs hover:text-red-500 transition-colors"
                      >
                        <FontAwesomeIcon icon={faTrash} className="mr-1.5" />
                        Eliminar
                      </button>
                    )}
                  </div>

                  {/* Reply form inline */}
                  {replyParentId === c.id && (
                    <div className="mt-4 card p-5">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-bold text-[var(--color-text)]">
                          Responder a{" "}
                          <span className="text-teal">
                            {p.display_name || `@${p.username}`}
                          </span>
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setReplyParentId(null);
                            setReplyText("");
                            setErrorReply(null);
                          }}
                          className="text-muted hover:text-[var(--color-text)]"
                        >
                          <FontAwesomeIcon icon={faX} className="text-sm" />
                        </button>
                      </div>
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        className="form-input"
                        rows={3}
                        placeholder="Escribe una respuesta..."
                      />
                      {errorReply && (
                        <p className="text-red-500 text-xs mt-2">
                          {errorReply}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          type="button"
                          onClick={() => handleReply(c.id)}
                          disabled={submittingReply || !replyText.trim()}
                          className="btn btn-outline text-xs"
                        >
                          {submittingReply ? (
                            <FontAwesomeIcon icon={faSpinner} spin />
                          ) : (
                            <FontAwesomeIcon icon={faPaperPlane} />
                          )}
                          <span>Responder</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Nested replies */}
                  {replies.length > 0 && (
                    <div className="flex flex-col gap-6 mt-5 ml-3 sm:ml-6 border-l-2 border-[var(--color-border)] pl-4 sm:pl-6">
                      {replies.map((r) => {
                        const rp = normalizeProfile(r.profiles);
                        if (!rp) return null;
                        const isReplyOwn = rp.id === currentUserId;
                        return (
                          <div key={r.id} className="flex gap-3">
                            <Avatar profile={rp} size={32} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-3 flex-wrap">
                                <Link
                                  href={`/profile/${rp.username}`}
                                  className="text-sm font-bold text-[var(--color-text)] hover:text-teal transition-colors"
                                >
                                  {rp.display_name || rp.username}
                                </Link>
                                <span className="text-muted text-xs">
                                  {formatDate(r.created_at)}
                                </span>
                              </div>
                              <p className="text-sm sm:text-base text-[var(--color-text)] mt-1.5 leading-relaxed">
                                {r.content}
                              </p>
                              {isReplyOwn && (
                                <button
                                  type="button"
                                  onClick={() => handleDelete(r.id)}
                                  className="text-muted text-xs mt-2 hover:text-red-500 transition-colors"
                                >
                                  <FontAwesomeIcon
                                    icon={faTrash}
                                    className="mr-1.5"
                                  />
                                  Eliminar
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Top-level comment form */}
      {currentUserId ? (
        <div className="mt-6">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            className="form-input"
            rows={3}
            placeholder="Deja un comentario sobre esta crítica..."
          />
          {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !commentText.trim()}
              className="btn btn-outline text-xs"
            >
              {submitting ? (
                <FontAwesomeIcon icon={faSpinner} spin />
              ) : (
                <FontAwesomeIcon icon={faPaperPlane} />
              )}
              <span>Comentar</span>
            </button>
          </div>
        </div>
      ) : (
        <p className="text-muted text-sm mt-6">
          <Link href="/login" className="text-teal font-bold hover:underline">
            Inicia sesión
          </Link>{" "}
          para dejar un comentario.
        </p>
      )}
    </div>
  );
}