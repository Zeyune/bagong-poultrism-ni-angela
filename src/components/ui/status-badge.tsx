import type { FlockStatus } from "@prisma/client";

// Status is carried by colour AND the text label (DESIGN §2.4 — never colour
// alone). The label is always present, so the badge reads correctly in greyscale
// or bright sun.
const STYLES: Record<FlockStatus, string> = {
  ACTIVE: "bg-success-weak text-success",
  INACTIVE: "bg-surface-sunken text-text-muted",
  PROCESSED: "bg-info-weak text-info",
  ARCHIVED: "bg-surface-sunken text-text-muted",
};

export function StatusBadge({ status }: { status: FlockStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-semibold ${STYLES[status]}`}
    >
      <span aria-hidden className="text-[0.6rem] leading-none">
        ●
      </span>
      {status}
    </span>
  );
}
