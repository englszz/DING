"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTrash,
  faSpinner,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
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
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteAlbumRating(ratingId);
      setShowConfirm(false);
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
        onClick={() => setShowConfirm(true)}
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

      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={() => {
            if (!deleting) setShowConfirm(false);
          }}
        >
          <div
            className="card p-6 w-full max-w-sm text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <FontAwesomeIcon
              icon={faTriangleExclamation}
              className="text-red-500 text-2xl mb-3"
            />
            <h3 className="font-display text-lg mb-2 text-[var(--color-text)]">
              ¿Eliminar calificación?
            </h3>
            <p className="text-muted text-sm mb-5">
              Se eliminará esta calificación y el álbum dejará de aparecer en tu
              diario.
            </p>
            {error && <p className="text-red-500 text-xs mb-3">{error}</p>}
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={deleting}
                className="btn btn-outline text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="btn bg-red-600 text-white text-xs hover:bg-red-700"
              >
                {deleting ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} spin />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faTrash} />
                    <span>Eliminar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}