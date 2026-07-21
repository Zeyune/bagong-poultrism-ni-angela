// Skeletons matching the final card layout (DESIGN §7.1) — not a centred spinner,
// so there is no layout shift when the data arrives.
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading flocks">
      <div className="h-8 w-40 animate-pulse rounded-md bg-surface-sunken" />
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-11 w-20 animate-pulse rounded-full bg-surface-sunken"
          />
        ))}
      </div>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3].map((i) => (
          <li
            key={i}
            className="h-32 animate-pulse rounded-lg border border-border bg-surface"
          />
        ))}
      </ul>
    </div>
  );
}
