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

interface Props {
  albumId: string;
  existingRating: number | null;
  existingReview: string | null;
}

export function AlbumActions({
  albumId,
  existingRating,
  existingReview,
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
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="btn btn-primary text-xs"
        >
          <FontAwesomeIcon icon={existingRating ? faPenToSquare : faPlus} />
          <span>
            {existingRating ? "Editar calificación" : "Calificar álbum"}
          </span>
        </button>
        <button
          type="button"
          onClick={handleListen}
          disabled={listening}
          className="btn btn-outline text-xs"
        >
          {listening ? (
            <FontAwesomeIcon icon={faSpinner} spin className="text-teal" />
          ) : (
            <FontAwesomeIcon icon={faPlus} className="text-teal" />
          )}
          <span>Registrar escucha</span>
        </button>
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
