import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { serializeFlock, serializeBird } from "@/lib/flocks/serialize";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatusActions } from "./status-actions";
import { AddBird } from "./add-bird";

export const dynamic = "force-dynamic";

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums text-text">{value}</dd>
    </div>
  );
}

export default async function FlockDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const row = await db.flock.findFirst({
    where: { id, farmId: user.farmId },
    include: { birds: { orderBy: { tag: "asc" } } },
  });
  if (!row) notFound();

  const flock = serializeFlock(row);
  const birds = row.birds.map(serializeBird);
  const isAdmin = user.role === "ADMIN";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/flocks" className="text-sm font-semibold text-secondary">
          ← Flocks
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-heading text-2xl font-bold text-text sm:text-[2rem]">
            {flock.name}
          </h1>
          <div className="flex items-center gap-3">
            <StatusBadge status={flock.status} />
            {isAdmin && (
              <Link
                href={`/flocks/${flock.id}/edit`}
                className="min-h-11 rounded-md border border-border-strong px-3 text-sm font-semibold text-text hover:bg-surface-sunken inline-flex items-center"
              >
                Edit
              </Link>
            )}
          </div>
        </div>
        <p className="mt-1 text-sm text-text-muted">
          {flock.type} · {flock.breed ?? "No breed recorded"}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-surface p-4 sm:grid-cols-4">
        <Stat
          label="Birds"
          value={
            <>
              {flock.currentCount}
              <span className="text-text-muted">/{flock.initialCount}</span>
            </>
          }
        />
        <Stat label="Start date" value={flock.startDate} />
        <Stat
          label="Cycle length"
          value={flock.cycleLengthDays ? `${flock.cycleLengthDays}d` : "—"}
        />
        <Stat
          label="To processing"
          value={
            flock.daysToProcessing !== null ? `${flock.daysToProcessing}d` : "—"
          }
        />
      </dl>

      {isAdmin && (
        <section className="space-y-2">
          <h2 className="font-heading text-lg font-semibold text-text">
            Status
          </h2>
          <StatusActions flockId={flock.id} status={flock.status} />
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-heading text-lg font-semibold text-text">
          Tagged birds{" "}
          <span className="text-sm font-normal text-text-muted">
            ({birds.length})
          </span>
        </h2>
        {birds.length === 0 ? (
          <p className="text-sm text-text-muted">
            No individual birds tagged. Tracking is flock-level by default (BR-07);
            tagging is optional.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
            {birds.map((bird) => (
              <li
                key={bird.id}
                className="flex items-center justify-between px-4 py-2 text-sm"
              >
                <span className="font-semibold tabular-nums text-text">
                  {bird.tag}
                </span>
                <span className="text-text-muted">{bird.status}</span>
              </li>
            ))}
          </ul>
        )}
        {isAdmin && <AddBird flockId={flock.id} />}
      </section>
    </div>
  );
}
