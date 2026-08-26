"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar, faChartPie } from "@fortawesome/free-solid-svg-icons";
import { TrackRatingInput } from "@/components/TrackRatingInput";
import { PieChart } from "@/components/PieChart";

interface Track {
  id: string;
  track_number: number;
  title: string;
  duration_ms?: number | null;
}

interface TrackListProps {
  tracks: Track[];
  initialTrackRatings: Record<string, number>;
  isOwner: boolean;
}

export function TrackList({ tracks, initialTrackRatings, isOwner }: TrackListProps) {
  const [trackRatings, setTrackRatings] = useState<Record<string, number>>(initialTrackRatings);

  const handleRatingChange = (trackId: string, rating: number | null) => {
    setTrackRatings((prev) => {
      const next = { ...prev };
      if (rating === null) {
        delete next[trackId];
      } else {
        next[trackId] = rating;
      }
      return next;
    });
  };

  const ratedTracks = Object.values(trackRatings);
  const avgTrackRating =
    ratedTracks.length > 0
      ? (ratedTracks.reduce((s, r) => s + r, 0) / ratedTracks.length).toFixed(1)
      : null;

  const distribution: Record<number, number> = {};
  for (let i = 0; i <= 10; i++) distribution[i] = 0;
  ratedTracks.forEach((r) => {
    const bucket = Math.min(10, Math.max(0, Math.round(r)));
    distribution[bucket]++;
  });

  const formatDuration = (ms?: number | null) => {
    if (!ms) return "";
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Tracklist */}
      <div className="lg:col-span-2">
        <h2 className="section-title">
          Tracklist
          <span className="text-muted text-sm font-body font-normal ml-2">
            ({tracks.length} canciones)
          </span>
          {avgTrackRating && (
            <span className="rating-badge text-xs ml-3">
              <FontAwesomeIcon icon={faStar} className="text-[10px] mr-1" />
              Promedio: {avgTrackRating}
            </span>
          )}
        </h2>

        <div className="card p-0 overflow-hidden">
          {tracks.map((track) => {
            const currentRating = trackRatings[track.id];
            return (
              <div
                key={track.id}
                className="flex items-center justify-between p-4 border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-surface-alt)] transition-colors"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <span className="text-muted text-sm font-mono w-6 text-center flex-shrink-0">
                    {String(track.track_number).padStart(2, "0")}
                  </span>
                  <p className="font-semibold text-sm text-[var(--color-text)] truncate">
                    {track.title}
                  </p>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  <span className="text-muted text-xs font-mono hidden sm:inline">
                    {formatDuration(track.duration_ms)}
                  </span>
                  {currentRating !== undefined && (
                    <div className="rating-badge text-xs py-1 px-3 hidden sm:flex">
                      <FontAwesomeIcon
                        icon={faStar}
                        className="text-[10px] mr-1"
                      />
                      {currentRating.toFixed(1)}
                    </div>
                  )}
                  {isOwner && (
                    <TrackRatingInput
                      trackId={track.id}
                      existingRating={currentRating ?? null}
                      onRatingChange={(r) => handleRatingChange(track.id, r)}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sidebar: Pie Chart */}
      <div className="flex flex-col gap-8">
        <div>
          <h2 className="section-title mb-2">
            Distribución de Ratings
          </h2>
          <div className="mt-6">
            <PieChart ratings={distribution} totalTracks={ratedTracks.length} />
          </div>
        </div>

        {ratedTracks.length > 0 && (
          <div className="card p-4 text-center">
            <p className="text-muted text-xs font-medium uppercase tracking-wider mb-1">
              Tracks calificados
            </p>
            <p className="text-teal text-2xl font-bold">
              {ratedTracks.length}
              <span className="text-muted text-sm font-normal">
                {" "}
                / {tracks.length}
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
