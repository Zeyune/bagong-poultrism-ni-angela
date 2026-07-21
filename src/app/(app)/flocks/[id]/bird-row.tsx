"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { inputClass } from "@/components/ui/field";

type Bird = { id: string; tag: string; status: string };

// One bird row: view by default; Admins get inline tag edit and a two-step remove.
// Bird tracking is inert (G-45), so this is light-touch by design.
export function BirdRow({ bird, isAdmin }: { bird: Bird; isAdmin: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit" | "confirmRemove">("view");
  const [tag, setTag] = useState(bird.tag);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!tag.trim() || tag.trim() === bird.tag) {
      setMode("view");
      setTag(bird.tag);
      return;
    }
    setPending(true);
    setError(null);
    const res = await fetch(`/api/v1/birds/${bird.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tag: tag.trim() }),
    });
    setPending(false);
    if (res.ok) {
      setMode("view");
      router.refresh();
      return;
    }
    const json = await res.json().catch(() => ({}));
    setError(json.error?.message ?? "Could not save.");
  }

  async function remove() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/v1/birds/${bird.id}`, { method: "DELETE" });
    setPending(false);
    if (res.ok) {
      router.refresh();
      return;
    }
    const json = await res.json().catch(() => ({}));
    setError(json.error?.message ?? "Could not remove.");
    setMode("view");
  }

  return (
    <li className="px-4 py-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        {mode === "edit" ? (
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            aria-label="Bird tag"
            className={`${inputClass} max-w-[10rem] py-1`}
          />
        ) : (
          <span className="font-semibold tabular-nums text-text">{bird.tag}</span>
        )}

        <div className="flex items-center gap-3">
          {mode === "view" && (
            <span className="text-text-muted">{bird.status}</span>
          )}

          {isAdmin && mode === "view" && (
            <>
              <button
                type="button"
                onClick={() => setMode("edit")}
                className="min-h-11 font-semibold text-secondary"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setMode("confirmRemove")}
                className="min-h-11 font-semibold text-danger"
              >
                Remove
              </button>
            </>
          )}

          {isAdmin && mode === "edit" && (
            <>
              <button
                type="button"
                onClick={save}
                disabled={pending}
                className="min-h-11 font-semibold text-primary"
              >
                {pending ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("view");
                  setTag(bird.tag);
                  setError(null);
                }}
                className="min-h-11 font-semibold text-text-muted"
              >
                Cancel
              </button>
            </>
          )}

          {isAdmin && mode === "confirmRemove" && (
            <>
              <span className="text-text-body">Remove {bird.tag}?</span>
              <button
                type="button"
                onClick={remove}
                disabled={pending}
                className="min-h-11 font-semibold text-danger"
              >
                {pending ? "Removing…" : "Confirm"}
              </button>
              <button
                type="button"
                onClick={() => setMode("view")}
                className="min-h-11 font-semibold text-text-muted"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-danger">
          <span aria-hidden>⚠ </span>
          {error}
        </p>
      )}
    </li>
  );
}
