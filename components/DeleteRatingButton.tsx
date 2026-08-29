"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { deleteAlbumRating } from "@/app/(app)/profile/actions";

export function DeleteRatingButton({
  ratingId,
  redirectHref,
  dark = false,
}: {
  ratingId: string;
  redirectHref?: string;
  dark?: boolean;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm("¿Eliminar esta calificación?")) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteAlbumRating(ratingId);
      if (redirectHref) {
        router.push(redirectHref);
        router.refresh();
      } else {
        router.refresh();
      }
    } catch (e: any) {
      setError(e.message || "Error al eliminar");
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className={
          dark
            ? "text-white hover:text-white transition-opacity"
            : "text-muted hover:text-red-500 transition-colors"
        }
        title="Eliminar calificación"
      >
        {deleting ? (
          <FontAwesomeIcon icon={faSpinner} spin className="text-xs" />
        ) : (
          <FontAwesomeIcon icon={faTrash} className="text-xs" />
        )}
      </button>
      {error && <p className="text-red-500 text-xs">{error}</p>}
    </>
  );
}
