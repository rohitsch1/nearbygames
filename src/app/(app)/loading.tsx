export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl space-y-3 px-4 py-6 md:px-8" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-surface-2" />
      {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface-2" />)}
    </div>
  );
}
