import type { Flock, Bird } from "@prisma/client";
import { daysToProcessing } from "@/lib/flocks/lifecycle";

function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// API shape for a Flock. daysToProcessing and withdrawalUntil are derived/denormalized
// (API.md §flocks). No financial fields exist on a flock, so nothing is role-stripped here.
export function serializeFlock(flock: Flock) {
  return {
    id: flock.id,
    name: flock.name,
    type: flock.type,
    breed: flock.breed,
    initialCount: flock.initialCount,
    currentCount: flock.currentCount,
    startDate: dateOnly(flock.startDate),
    cycleLengthDays: flock.cycleLengthDays,
    status: flock.status,
    defaultFeedItemId: flock.defaultFeedItemId,
    growthCurveId: flock.growthCurveId,
    withdrawalUntil: flock.withdrawalUntil
      ? flock.withdrawalUntil.toISOString()
      : null,
    daysToProcessing: daysToProcessing(flock),
    createdAt: flock.createdAt.toISOString(),
    updatedAt: flock.updatedAt.toISOString(),
  };
}

export function serializeBird(bird: Bird) {
  return {
    id: bird.id,
    flockId: bird.flockId,
    tag: bird.tag,
    status: bird.status,
    hatchDate: bird.hatchDate ? dateOnly(bird.hatchDate) : null,
    notes: bird.notes,
    createdAt: bird.createdAt.toISOString(),
  };
}
