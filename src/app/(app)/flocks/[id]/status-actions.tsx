"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FlockStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";

type Transition = {
  to: FlockStatus;
  label: string;
  consequence: string;
  danger?: boolean;
};

// The consequences are named, not implied (Step 5 "Done when" — a status change
// confirmation that names what happens). Text mirrors BR §3.1's side effects.
const TRANSITIONS: Record<FlockStatus, Transition[]> = {
  ACTIVE: [
    {
      to: "INACTIVE",
      label: "Deactivate",
      consequence:
        "Daily logs will be rejected for this flock. Existing data stays and remains readable. You can reactivate it later.",
    },
  ],
  INACTIVE: [
    {
      to: "ACTIVE",
      label: "Reactivate",
      consequence: "Daily logging resumes for this flock.",
    },
    {
      to: "ARCHIVED",
      label: "Archive",
      consequence:
        "Archiving is permanent and cannot be undone. The flock is hidden from active views but kept for reporting.",
      danger: true,
    },
  ],
  PROCESSED: [
    {
      to: "ARCHIVED",
      label: "Archive",
      consequence:
        "Archiving is permanent and cannot be undone. The flock is hidden from active views but kept for reporting.",
      danger: true,
    },
  ],
  ARCHIVED: [],
};

export function StatusActions({
  flockId,
  status,
}: {
  flockId: string;
  status: FlockStatus;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState<Transition | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transitions = TRANSITIONS[status];

  function ask(t: Transition) {
    setPending(t);
    setError(null);
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
    setPending(null);
  }

  async function confirm() {
    if (!pending) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/v1/flocks/${flockId}/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: pending.to }),
    });
    setSubmitting(false);
    if (res.ok) {
      close();
      router.refresh();
      return;
    }
    const json = await res.json().catch(() => ({}));
    setError(json.error?.message ?? "Could not change status. Try again.");
  }

  if (transitions.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        This flock is archived — a terminal state with no further transitions.
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-3">
        {transitions.map((t) => (
          <Button
            key={t.to}
            variant={t.danger ? "danger" : "secondary"}
            onClick={() => ask(t)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      <dialog
        ref={dialogRef}
        className="m-auto max-w-md rounded-lg border border-border bg-surface p-6 text-text-body backdrop:bg-black/40"
        onClose={() => setPending(null)}
      >
        {pending && (
          <div className="space-y-4">
            <h3 className="font-heading text-lg font-semibold text-text">
              {pending.label} this flock?
            </h3>
            <p className="text-sm">{pending.consequence}</p>
            {error && (
              <p role="alert" className="text-sm text-danger">
                <span aria-hidden>⚠ </span>
                {error}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={close}
                className="min-h-11 rounded-md border border-border-strong px-4 text-base font-semibold text-text hover:bg-surface-sunken"
              >
                Cancel
              </button>
              <Button
                variant={pending.danger ? "danger" : "primary"}
                onClick={confirm}
                disabled={submitting}
              >
                {submitting ? "Working…" : pending.label}
              </Button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
