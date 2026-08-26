"use client";

interface PieChartProps {
  ratings: Record<number, number>; // e.g., { 0: 0, 1: 0, 2: 0, ..., 10: 5 }
  totalTracks: number;
}

// Colors matching the design system
const SLICE_COLORS = [
  "#262626", // 0
  "#7f1d1d", // 1
  "#991b1b", // 2
  "#b45309", // 3
  "#a16207", // 4
  "#4d7c0f", // 5
  "#15803d", // 6
  "#0f766e", // 7
  "#0891b2", // 8
  "#0097B2", // 9 - teal
  "#1d4ed8", // 10
];

export function PieChart({ ratings, totalTracks }: PieChartProps) {
  const segments: { startAngle: number; endAngle: number; color: string; count: number; label: string }[] = [];
  let currentAngle = -90; // Start from top

  for (let i = 0; i <= 10; i++) {
    const count = ratings[i] || 0;
    if (count === 0) continue;

    const sliceAngle = (count / totalTracks) * 360;
    segments.push({
      startAngle: currentAngle,
      endAngle: currentAngle + sliceAngle,
      color: SLICE_COLORS[i],
      count,
      label: `${i}.0`,
    });
    currentAngle += sliceAngle;
  }

  if (segments.length === 0) {
    return (
      <div className="card p-6 text-center">
        <p className="text-muted text-sm font-medium">
          Sin calificaciones de tracks aún
        </p>
      </div>
    );
  }

  const size = 180;
  const center = size / 2;
  const radius = center - 8;

  return (
    <div className="flex flex-col items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map((seg, idx) => {
          const startRad = (seg.startAngle * Math.PI) / 180;
          const endRad = (seg.endAngle * Math.PI) / 180;
          const x1 = center + radius * Math.cos(startRad);
          const y1 = center + radius * Math.sin(startRad);
          const x2 = center + radius * Math.cos(endRad);
          const y2 = center + radius * Math.sin(endRad);
          const largeArc = seg.endAngle - seg.startAngle > 180 ? 1 : 0;

          const pathD = [
            `M ${center} ${center}`,
            `L ${x1} ${y1}`,
            `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
            "Z",
          ].join(" ");

          return <path key={idx} d={pathD} fill={seg.color} stroke="var(--color-bg)" strokeWidth="2" />;
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5 text-xs font-medium">
            <div
              className="w-3 h-3 flex-shrink-0"
              style={{ backgroundColor: seg.color }}
            />
            <span className="text-muted">{seg.label}</span>
            <span className="text-[var(--color-text)]">({seg.count})</span>
          </div>
        ))}
      </div>
    </div>
  );
}
