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

type ThreadNode = CommentRow & { children: ThreadNode[] };

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
  const [replyParentName, setReplyParentName] = useState<string | null>(null);
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
      await loadComments();
      if (active) setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [loadComments]);

  // Build a nested thread tree from the flat rowns
  const thread = useMemo(() => {
    const nodes = new Map<string, ThreadNode>();
    const roots: ThreadNode[] = [];
    rows.forEach((c) => nodes.set(c.id, { ...c, children: [] }));
    rows.forEach((c) => {
      const node = nodes.get(c.id)!;
      if (c.parent_id && nodes.has(c.parent_id)) {
        nodes.get(c.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    });
    return roots;
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
      setReplyParentName(null);
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

  function handleStartReply(node: ThreadNode, profile: any) {
    setReplyParentId(node.id);
    setReplyParentName(profile.display_name || `@${profile.username}`);
    setReplyText("");
    setErrorReply(null);
  }

  function renderComment(node: ThreadNode, depth: number) {
    const p = normalizeProfile(node.profiles);
    if (!p || !isVisible(p)) {
      // Keep rendering descendants even if this comment is hidden
      return (
        <div key={node.id} className="flex flex-col gap-6">
          {node.children.map((child) => renderComment(child, depth))}
        </div>
      );
    }
    const isOwn = p.id === currentUserId;
    const showReplyForm = replyParentId === node.id;
    const indent = depth === 0 ? "" : "ml-3 sm:ml-6 border-l-2 border-[var(--color-border)] pl-3 sm:pl-6";

    return (
      <div key={node.id} className={indent}>
        <div className="flex gap-4">
          <Avatar profile={p} size={depth === 0 ? 40 : 34} />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-3 flex-wrap">
              <Link
                href={`/profile/${p.username}`}
                className="text-sm font-bold text-[var(--color-text)] hover:text-teal transition-colors"
              >
                {p.display_name || p.username}
              </Link>
              <span className="text-muted text-xs">
                {formatDate(node.created_at)}
              </span>
            </div>
            <p className="text-sm sm:text-base text-[var(--color-text)] mt-2 leading-relaxed">
              {node.content}
            </p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 mt-4">
              <button
                type="button"
                onClick={() => handleStartReply(node, p)}
                className="text-teal text-xs font-bold hover:opacity-80 transition-opacity"
              >
                <FontAwesomeIcon icon={faReply} className="mr-1.5" />
                Responder
              </button>
              {isOwn && (
                <button
                  type="button"
                  onClick={() => handleDelete(node.id)}
                  className="text-muted text-xs hover:text-red-500 transition-colors"
                >
                  <FontAwesomeIcon icon={faTrash} className="mr-1.5" />
                  Eliminar
                </button>
              )}
            </div>

            {/* Inline reply form */}
            {showReplyForm && (
              <div className="mt-4 card p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-[var(--color-text)]">
                    Responder a{" "}
                    <span className="text-teal">{replyParentName}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setReplyParentId(null);
                      setReplyParentName(null);
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
                  <p className="text-red-500 text-xs mt-2">{errorReply}</p>
                )}
                <div className="flex items-center gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => handleReply(node.id)}
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

            {/* Replies */}
            {node.children.length > 0 && (
              <div className="flex flex-col gap-6 mt-6">
                {node.children.map((child) => renderComment(child, depth + 1))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mt-9 pt-7 border-t border-[var(--color-border)]">
        <p className="text-muted text-xs">
          <FontAwesomeIcon icon={faSpinner} spin className="mr-1" /> Cargando
          comentarios...
        </p>
      </div>
    );
  }

  return (
    <div className="mt-9 pt-7 border-t border-[var(--color-border)]">
      <p className="text-sm font-semibold text-muted uppercase tracking-wider mb-6">
        <FontAwesomeIcon icon={faComment} className="mr-1.5" />
        Comentarios ({rows.length})
      </p>

      {/* Comment list */}
      {rows.length === 0 ? (
        <p className="text-muted text-sm mb-6">
          Sé el primero en comentar esta reseña.
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {thread.map((node) => renderComment(node, 0))}
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
          <div className="flex items-center gap-3 mt-4">
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