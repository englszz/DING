export default function Loading() {
  return (
    <div className="page-container py-4 flex-1 w-full space-y-8">
      <div className="card animate-pulse">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 bg-[var(--color-surface-alt)] flex-shrink-0" />
          <div className="flex-1 space-y-3">
            <div className="h-6 w-40 bg-[var(--color-surface-alt)]" />
            <div className="h-4 w-24 bg-[var(--color-surface-alt)]" />
            <div className="h-4 w-56 bg-[var(--color-surface-alt)]" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card h-40 animate-pulse bg-[var(--color-surface)]" />
        ))}
      </div>
    </div>
  );
}
