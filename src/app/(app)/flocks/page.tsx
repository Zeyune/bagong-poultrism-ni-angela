import Link from "next/link";
import type { Prisma, FlockStatus, FlockType } from "@prisma/client";
import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { serializeFlock } from "@/lib/flocks/serialize";
import { StatusBadge } from "@/components/ui/status-badge";

export const dynamic = "force-dynamic";

const STATUS_FILTERS: Array<{ label: string; value: FlockStatus | "" }> = [
  { label: "All", value: "" },
  { label: "Active", value: "ACTIVE" },
  { label: "Inactive", value: "INACTIVE" },
  { label: "Processed", value: "PROCESSED" },
  { label: "Archived", value: "ARCHIVED" },
];

const TYPE_FILTERS: Array<{ label: string; value: FlockType | "" }> = [
  { label: "All types", value: "" },
  { label: "Layer", value: "LAYER" },
  { label: "Broiler", value: "BROILER" },
];

function FilterChip({
  active,
  href,
  children,
}: {
  active: boolean;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`min-h-11 inline-flex items-center rounded-full px-3 text-sm font-semibold ${
        active
          ? "bg-primary text-white"
          : "border border-border text-text-body hover:bg-surface"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function FlocksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const filtered = Boolean(sp.status || sp.type);

  const where: Prisma.FlockWhereInput = { farmId: user.farmId };
  if (sp.status) where.status = sp.status as FlockStatus;
  if (sp.type) where.type = sp.type as FlockType;

  const rows = await db.flock.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  const flocks = rows.map(serializeFlock);

  const buildHref = (patch: { status?: string; type?: string }) => {
    const next = new URLSearchParams();
    const status = patch.status ?? sp.status ?? "";
    const type = patch.type ?? sp.type ?? "";
    if (status) next.set("status", status);
    if (type) next.set("type", type);
    const qs = next.toString();
    return qs ? `/flocks?${qs}` : "/flocks";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold text-text sm:text-[2rem]">
          Flocks
        </h1>
        {user.role === "ADMIN" && (
          <Link
            href="/flocks/new"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-base font-semibold text-white hover:bg-primary-hover"
          >
            New flock
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <FilterChip
              key={f.label}
              active={(sp.status ?? "") === f.value}
              href={buildHref({ status: f.value })}
            >
              {f.label}
            </FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {TYPE_FILTERS.map((f) => (
            <FilterChip
              key={f.label}
              active={(sp.type ?? "") === f.value}
              href={buildHref({ type: f.value })}
            >
              {f.label}
            </FilterChip>
          ))}
        </div>
      </div>

      {flocks.length === 0 ? (
        filtered ? (
          <EmptyFiltered />
        ) : (
          <EmptyFirstRun isAdmin={user.role === "ADMIN"} />
        )
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {flocks.map((flock) => (
            <li key={flock.id}>
              <Link
                href={`/flocks/${flock.id}`}
                className="block h-full rounded-lg border border-border bg-surface p-4 transition-shadow hover:shadow-[0_1px_2px_rgb(0_0_0/.06)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-heading text-lg font-semibold text-text">
                    {flock.name}
                  </span>
                  <StatusBadge status={flock.status} />
                </div>
                <p className="mt-1 text-sm text-text-muted">
                  {flock.type} · {flock.breed ?? "—"}
                </p>
                <dl className="mt-3 flex gap-6 text-sm tabular-nums">
                  <div>
                    <dt className="text-text-muted">Birds</dt>
                    <dd className="text-base font-semibold text-text">
                      {flock.currentCount}
                      <span className="text-text-muted">/{flock.initialCount}</span>
                    </dd>
                  </div>
                  {flock.daysToProcessing !== null && (
                    <div>
                      <dt className="text-text-muted">To processing</dt>
                      <dd className="text-base font-semibold text-text">
                        {flock.daysToProcessing}d
                      </dd>
                    </div>
                  )}
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyFirstRun({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="rounded-lg border border-dashed border-border-strong bg-surface p-8 text-center">
      <h2 className="font-heading text-lg font-semibold text-text">
        No flocks yet
      </h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-text-body">
        A flock is a group of birds you manage together — a batch of layers or
        broilers. Create one to start recording daily logs against it.
      </p>
      {isAdmin && (
        <Link
          href="/flocks/new"
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-base font-semibold text-white hover:bg-primary-hover"
        >
          Create your first flock
        </Link>
      )}
    </div>
  );
}

function EmptyFiltered() {
  return (
    <div className="rounded-lg border border-dashed border-border-strong bg-surface p-8 text-center">
      <h2 className="font-heading text-lg font-semibold text-text">
        No flocks match these filters
      </h2>
      <Link
        href="/flocks"
        className="mt-3 inline-flex min-h-11 items-center justify-center rounded-md border border-border-strong px-4 text-base font-semibold text-text hover:bg-surface-sunken"
      >
        Clear filters
      </Link>
    </div>
  );
}
