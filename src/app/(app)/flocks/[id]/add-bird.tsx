"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";

// Inline add-a-bird (POST /flocks/:id/birds). Tags are unique within the flock
// (BR-17); a repeat comes back 409 and is shown at the field.
export function AddBird({ flockId }: { flockId: string }) {
  const router = useRouter();
  const [tag, setTag] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!tag.trim()) return;
    setPending(true);
    setError(null);

    const res = await fetch(`/api/v1/flocks/${flockId}/birds`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tag: tag.trim() }),
    });
    setPending(false);

    if (res.ok) {
      setTag("");
      router.refresh();
      return;
    }
    const json = await res.json().catch(() => ({}));
    setError(json.error?.message ?? "Could not add the bird.");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-1">
      <div className="flex gap-2">
        <label htmlFor="bird-tag" className="sr-only">
          Bird tag
        </label>
        <input
          id="bird-tag"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="Tag, e.g. B-001"
          aria-describedby={error ? "bird-tag-error" : undefined}
          className={`${inputClass} max-w-xs`}
        />
        <Button type="submit" variant="secondary" disabled={pending || !tag.trim()}>
          {pending ? "Adding…" : "Add bird"}
        </Button>
      </div>
      {error && (
        <p id="bird-tag-error" className="text-sm text-danger">
          <span aria-hidden>⚠ </span>
          {error}
        </p>
      )}
    </form>
  );
}
