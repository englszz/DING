"use client";

interface PieChartProps {
  ratings: Record<number, number>;
  totalTracks: number;
}

export function PieChart({ ratings, totalTracks }: PieChartProps) {
  const entries = Object.entries(ratings).filter(([, count]) => count > 0).sort(([a], [b]) => Number(b) - Number(a));
  if (!totalTracks || !entries.length) return <div className="card p-5 text-sm text-muted">Califica tu primera canción para ver cómo se reparten tus notas.</div>;
  return (
    <div className="card p-5">
      <p className="text-sm font-semibold mb-2">¿Qué notas has puesto?</p>
      <p className="text-xs text-muted mb-5">Cada barra muestra cuántas canciones tienen esa nota. Los decimales se agrupan en el entero más cercano; por ejemplo, 8.5 cuenta en 9.</p>
      <ul className="space-y-4" aria-label="Distribución de tus notas por canción">
        {entries.map(([rating, count]) => {
          const percent = Math.round(count / totalTracks * 100);
          return <li key={rating}>
            <div className="flex flex-wrap justify-between gap-2 text-xs mb-2">
              <span className="font-semibold">{rating} / 10</span>
              <span className="text-muted">{count} {count === 1 ? "canción" : "canciones"} · {percent}%</span>
            </div>
            <div className="h-2 bg-[var(--color-surface-alt)]" aria-hidden="true"><div className="h-full bg-teal" style={{ width: `${percent}%` }} /></div>
          </li>;
        })}
      </ul>
      <p className="text-xs text-muted mt-5">Sobre {totalTracks} {totalTracks === 1 ? "canción calificada" : "canciones calificadas"}. Las pendientes no cuentan.</p>
    </div>
  );
}
