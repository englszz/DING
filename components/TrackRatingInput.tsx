"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar, faSpinner } from "@fortawesome/free-solid-svg-icons";
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
  const [rating, setRating] = useState<string>(
    existingRating !== null && existingRating !== undefined
      ? existingRating.toFixed(1)
      : ""
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleChange = async (val: string) => {
    if (val === "") {
      setRating("");
      setSaving(true);
      try {
        await deleteTrackRating(trackId);
        onRatingChange?.(null);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      } catch {
        // ignore
      }
      setSaving(false);
      return;
    }

    let num = parseFloat(val);
    if (isNaN(num)) return;
    if (num > 10) num = 10;
    if (num < 0) num = 0;

    const rounded = Math.round(num * 10) / 10;
    const display = rounded.toFixed(1);
    setRating(display);
    setSaving(true);
    setSaved(false);

    try {
      await saveTrackRating(trackId, rounded);
      onRatingChange?.(rounded);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch {
      // Revert on error
    }
    setSaving(false);
  };

  return (
    <div className="flex items-center gap-2">
      <FontAwesomeIcon
        icon={faStar}
        className={`text-xs transition-colors ${rating ? "text-teal" : "text-muted"}`}
      />
      <input
        type="text"
        inputMode="decimal"
        value={rating}
        onChange={(e) => {
          const raw = e.target.value;
          if (/^\d{0,2}(\.\d?)?$/.test(raw) || raw === "") {
            handleChange(raw);
          }
        }}
        placeholder="—"
        className="form-input text-xs py-1 px-2 text-center"
        style={{ width: "56px" }}
        disabled={saving}
      />
      {saving && (
        <FontAwesomeIcon icon={faSpinner} spin className="text-teal text-xs" />
      )}
      {saved && (
        <span className="text-teal text-[10px] font-bold">✓</span>
      )}
    </div>
  );
}
