"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";

type FieldErrors = Record<string, string>;
type FeedItem = { id: string; name: string };
type GrowthCurve = { id: string; name: string; breed: string };

// Only the PATCH-editable fields appear (name, breed, cycle, feed item, growth
// curve). type and currentCount are immutable and absent by design (BR-02, BR-13).
type FlockView = {
  id: string;
  name: string;
  type: "LAYER" | "BROILER";
  breed: string | null;
  cycleLengthDays: number | null;
  defaultFeedItemId: string | null;
  growthCurveId: string | null;
};

export function EditFlockForm({
  flock,
  feedItems,
  growthCurves,
}: {
  flock: FlockView;
  feedItems: FeedItem[];
  growthCurves: GrowthCurve[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setErrors({});
    setGeneralError(null);

    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const breed = String(form.get("breed") ?? "").trim();
    const cycleRaw = String(form.get("cycleLengthDays") ?? "").trim();
    const feedId = String(form.get("defaultFeedItemId") ?? "");
    const curveId = String(form.get("growthCurveId") ?? "");

    // Empty selections/inputs send null, so a field can be cleared (the PATCH
    // schema accepts null).
    const body: Record<string, unknown> = { name };
    body.breed = breed ? breed : null;
    body.defaultFeedItemId = feedId ? feedId : null;
    if (flock.type === "BROILER") {
      body.cycleLengthDays = cycleRaw ? Number(cycleRaw) : null;
      body.growthCurveId = curveId ? curveId : null;
    }

    const res = await fetch(`/api/v1/flocks/${flock.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));

    if (res.ok) {
      router.push(`/flocks/${flock.id}`);
      router.refresh();
      return;
    }

    if (Array.isArray(json.error?.details)) {
      const mapped: FieldErrors = {};
      for (const d of json.error.details) mapped[d.field] = d.message;
      setErrors(mapped);
    } else {
      setGeneralError(json.error?.message ?? "Something went wrong. Try again.");
    }
    setPending(false);
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Link
          href={`/flocks/${flock.id}`}
          className="text-sm font-semibold text-secondary"
        >
          ← {flock.name}
        </Link>
        <h1 className="mt-1 font-heading text-2xl font-bold text-text">
          Edit flock
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Type and bird count can’t be changed here — they’re set by the system.
        </p>
      </div>

      {generalError && (
        <p
          role="alert"
          className="rounded-md border border-danger bg-danger-weak px-3 py-2 text-sm text-danger"
        >
          {generalError}
        </p>
      )}

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field id="name" label="Name" required error={errors.name}>
          <input
            id="name"
            name="name"
            required
            defaultValue={flock.name}
            aria-describedby={errors.name ? "name-error" : undefined}
            className={inputClass}
          />
        </Field>

        <Field id="breed" label="Breed" error={errors.breed}>
          <input
            id="breed"
            name="breed"
            defaultValue={flock.breed ?? ""}
            className={inputClass}
          />
        </Field>

        <Field
          id="defaultFeedItemId"
          label="Default feed item"
          error={errors.defaultFeedItemId}
          hint={
            feedItems.length === 0
              ? "No feed items exist yet — add one in Inventory to track feed consumption."
              : undefined
          }
        >
          <select
            id="defaultFeedItemId"
            name="defaultFeedItemId"
            defaultValue={flock.defaultFeedItemId ?? ""}
            disabled={feedItems.length === 0}
            className={inputClass}
          >
            <option value="">None</option>
            {feedItems.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </Field>

        {flock.type === "BROILER" && (
          <>
            <Field
              id="cycleLengthDays"
              label="Cycle length (days)"
              hint="Leave blank to clear."
              error={errors.cycleLengthDays}
            >
              <input
                id="cycleLengthDays"
                name="cycleLengthDays"
                type="number"
                min={1}
                inputMode="numeric"
                defaultValue={flock.cycleLengthDays ?? ""}
                className={inputClass}
              />
            </Field>

            <Field
              id="growthCurveId"
              label="Growth curve"
              error={errors.growthCurveId}
              hint={
                growthCurves.length === 0
                  ? "No growth curves exist yet — the growth report will be unavailable."
                  : undefined
              }
            >
              <select
                id="growthCurveId"
                name="growthCurveId"
                defaultValue={flock.growthCurveId ?? ""}
                disabled={growthCurves.length === 0}
                className={inputClass}
              >
                <option value="">None</option>
                {growthCurves.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.breed})
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
          <Link
            href={`/flocks/${flock.id}`}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-border-strong px-4 text-base font-semibold text-text hover:bg-surface-sunken"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
