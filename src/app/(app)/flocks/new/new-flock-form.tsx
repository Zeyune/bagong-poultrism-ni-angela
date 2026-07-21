"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";

type FieldErrors = Record<string, string>;
type FeedItem = { id: string; name: string };
type GrowthCurve = { id: string; name: string; breed: string };

export function NewFlockForm({
  feedItems,
  growthCurves,
  today,
}: {
  feedItems: FeedItem[];
  growthCurves: GrowthCurve[];
  today: string;
}) {
  const router = useRouter();
  const [type, setType] = useState<"LAYER" | "BROILER">("LAYER");
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setErrors({});
    setGeneralError(null);

    const form = new FormData(e.currentTarget);
    const cycleRaw = String(form.get("cycleLengthDays") ?? "").trim();
    const breedRaw = String(form.get("breed") ?? "").trim();
    const feedId = String(form.get("defaultFeedItemId") ?? "");
    const curveId = String(form.get("growthCurveId") ?? "");

    const body: Record<string, unknown> = {
      name: String(form.get("name") ?? "").trim(),
      type,
      initialCount: Number(form.get("initialCount")),
      startDate: String(form.get("startDate") ?? ""),
    };
    if (breedRaw) body.breed = breedRaw;
    if (feedId) body.defaultFeedItemId = feedId;
    if (type === "BROILER") {
      if (cycleRaw) body.cycleLengthDays = Number(cycleRaw);
      if (curveId) body.growthCurveId = curveId;
    }

    const res = await fetch("/api/v1/flocks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));

    if (res.ok) {
      router.push(`/flocks/${json.data.id}`);
      router.refresh();
      return;
    }

    // Errors preserve all input — the form is never cleared (DESIGN §7.1).
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
        <Link href="/flocks" className="text-sm font-semibold text-secondary">
          ← Flocks
        </Link>
        <h1 className="mt-1 font-heading text-2xl font-bold text-text">
          New flock
        </h1>
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
            aria-describedby={errors.name ? "name-error" : undefined}
            className={inputClass}
          />
        </Field>

        <Field
          id="type"
          label="Type"
          required
          error={errors.type}
          hint="Type is permanent — it can’t be changed after the flock is created."
        >
          <select
            id="type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as "LAYER" | "BROILER")}
            className={inputClass}
          >
            <option value="LAYER">Layer (eggs)</option>
            <option value="BROILER">Broiler (meat)</option>
          </select>
        </Field>

        <Field id="breed" label="Breed" error={errors.breed}>
          <input id="breed" name="breed" className={inputClass} />
        </Field>

        <Field
          id="initialCount"
          label="Initial bird count"
          required
          error={errors.initialCount}
        >
          <input
            id="initialCount"
            name="initialCount"
            type="number"
            min={1}
            required
            inputMode="numeric"
            aria-describedby={
              errors.initialCount ? "initialCount-error" : undefined
            }
            className={inputClass}
          />
        </Field>

        <Field id="startDate" label="Start date" required error={errors.startDate}>
          <input
            id="startDate"
            name="startDate"
            type="date"
            required
            max={today}
            aria-describedby={errors.startDate ? "startDate-error" : undefined}
            className={inputClass}
          />
        </Field>

        {/* Default feed item — feed consumption deducts from it (BR-24). */}
        <Field
          id="defaultFeedItemId"
          label="Default feed item"
          error={errors.defaultFeedItemId}
          hint={
            feedItems.length === 0
              ? "No feed items exist yet — feed consumption won’t be tracked until one is added in Inventory."
              : undefined
          }
        >
          <select
            id="defaultFeedItemId"
            name="defaultFeedItemId"
            defaultValue=""
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

        {type === "BROILER" && (
          <>
            <Field
              id="cycleLengthDays"
              label="Cycle length (days)"
              hint="Defaults to 45 if left blank."
              error={errors.cycleLengthDays}
            >
              <input
                id="cycleLengthDays"
                name="cycleLengthDays"
                type="number"
                min={1}
                inputMode="numeric"
                className={inputClass}
              />
            </Field>

            {/* Growth curve — broiler only; the growth report needs it (G-21). */}
            <Field
              id="growthCurveId"
              label="Growth curve"
              error={errors.growthCurveId}
              hint={
                growthCurves.length === 0
                  ? "No growth curves exist yet — the growth report will be unavailable for this flock."
                  : undefined
              }
            >
              <select
                id="growthCurveId"
                name="growthCurveId"
                defaultValue=""
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
            {pending ? "Creating…" : "Create flock"}
          </Button>
          <Link
            href="/flocks"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-border-strong px-4 text-base font-semibold text-text hover:bg-surface-sunken"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
