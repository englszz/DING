"use client";
import { useRef, useState } from "react";
import { saveTrackRating, deleteTrackRating } from "@/app/(app)/album/actions";
export function TrackRatingInput({
  trackId,
  existingRating,
  onRatingChange,
}: {
  trackId: string;
  existingRating?: number | null;
  onRatingChange?: (rating: number | null) => void;
}) {
  const [rating, setRating] = useState(
    existingRating == null ? "" : String(existingRating),
  );
  const committed = useRef(
    existingRating == null ? "" : String(existingRating),
  );
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  async function commit() {
    if (busy.current) return;
    const value = rating.trim().replace(",", ".");
    const num = value === "" ? null : Number(value);
    if (num !== null && (!Number.isFinite(num) || num < 0 || num > 10)) {
      setMessage("Usa un número entre 0 y 10");
      return;
    }
    const rounded = num === null ? null : Math.round(num * 10) / 10;
    const display = rounded === null ? "" : String(rounded);
    setRating(display);
    if (display === committed.current) return;
    busy.current = true;
    setSaving(true);
    setMessage("");
    try {
      if (rounded === null) await deleteTrackRating(trackId);
      else await saveTrackRating(trackId, rounded);
      committed.current = display;
      onRatingChange?.(rounded);
      setMessage("Guardado");
    } catch {
      setMessage("No se guardó. Inténtalo de nuevo.");
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <input
        aria-label="Puntuación de la canción"
        type="text"
        inputMode="decimal"
        value={rating}
        onChange={(e) => {
          if (/^\d{0,2}([.,]\d?)?$/.test(e.target.value)) {
            setRating(e.target.value);
            setMessage("");
          }
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        placeholder="—"
        className="form-input text-xs py-1 px-2 text-center"
        style={{ width: 64 }}
        disabled={saving}
      />
      <span role="status" className="text-xs text-muted">
        {saving ? "Guardando…" : message}
      </span>
    </div>
  );
}
