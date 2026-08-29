"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPenToSquare,
  faPlus,
  faCheck,
  faSpinner,
  faX,
} from "@fortawesome/free-solid-svg-icons";
import { saveAlbumRating, registerListen } from "@/app/(app)/album/actions";
import { DeleteRatingButton } from "@/components/DeleteRatingButton";

interface Props {
  albumId: string;
  existingRating: number | null;
  existingReview: string | null;
  deleteRatingId?: string;
}

export function AlbumActions({
  albumId,
  existingRating,
  existingReview,
  deleteRatingId,
}: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(!!existingRating);
  const [rating, setRating] = useState(existingRating?.toString() || "");
  const [review, setReview] = useState(existingReview || "");
  const [saving, setSaving] = useState(false);
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSaveRating = async () => {
    const numRating = parseFloat(rating);
    if (isNaN(numRating) || numRating < 0 || numRating > 10) {
      setMessage("El rating debe ser entre 0.0 y 10.0");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await saveAlbumRating(albumId, numRating, review);
      setShowForm(false);
      setMessage("Calificación guardada");
      router.refresh();
    } catch {
      setMessage("Error al guardar");
    }
    setSaving(false);
  };

  const handleListen = async () => {
    setListening(true);
    try {
      await registerListen(albumId);
      setMessage("Escucha registrada");
      router.refresh();
    } catch {
      setMessage("Error al registrar escucha");
    }
    setListening(false);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="btn btn-primary text-xs w-full sm:w-auto justify-center"
        >
          <FontAwesomeIcon icon={existingRating ? faPenToSquare : faPlus} />
          <span>
            {existingRating ? "Editar calificación" : "Calificar álbum"}
          </span>
        </button>
        <div className="flex items-stretch sm:items-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={handleListen}
            disabled={listening}
            className="btn btn-outline text-xs flex-1 sm:flex-none justify-center"
          >
            {listening ? (
              <FontAwesomeIcon icon={faSpinner} spin className="text-teal" />
            ) : (
              <FontAwesomeIcon icon={faPlus} className="text-teal" />
            )}
            <span>Registrar escucha</span>
          </button>
          {deleteRatingId && (
            <div className="w-11 sm:w-9 flex items-center justify-center bg-accent-2 hover:opacity-90 transition-opacity flex-shrink-0">
              <DeleteRatingButton
                ratingId={deleteRatingId}
                redirectHref="/dashboard"
                dark
              />
            </div>
          )}
        </div>
      </div>

      {/* Status Message */}
      {message && (
        <p
          className={`text-xs font-medium ${
            message.includes("Error") ? "text-red-500" : "text-teal"
          }`}
        >
          {message}
        </p>
      )}

      {/* Rating Form */}
      {showForm && (
        <div className="card p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="font-bold text-sm text-[var(--color-text)]">
              {existingRating ? "Editar calificación" : "Calificar álbum"}
            </p>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-muted hover:text-[var(--color-text)]"
            >
              <FontAwesomeIcon icon={faX} className="text-xs" />
            </button>
          </div>

          {/* Rating Input */}
          <div>
            <label className="form-label">Rating (0.0 - 10.0)</label>
            <input
              type="number"
              min="0"
              max="10"
              step="0.1"
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              className="form-input"
              placeholder="ej. 8.5"
            />
          </div>

          {/* Review */}
          <div>
            <label className="form-label">Reseña (opcional)</label>
            <textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              className="form-input"
              rows={3}
              placeholder="¿Qué opinas de este álbum?"
              style={{ resize: "vertical" }}
            />
          </div>

          {/* Save */}
          <button
            type="button"
            onClick={handleSaveRating}
            disabled={saving || !rating}
            className="btn btn-primary text-xs self-start"
          >
            {saving ? (
              <FontAwesomeIcon icon={faSpinner} spin />
            ) : (
              <FontAwesomeIcon icon={faCheck} />
            )}
            <span>Guardar</span>
          </button>
        </div>
      )}
    </div>
  );
}
