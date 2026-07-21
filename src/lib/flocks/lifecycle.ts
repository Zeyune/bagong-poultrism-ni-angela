import type { FlockStatus } from "@prisma/client";
import { farmTodayUtcMidnight } from "@/lib/time";

// The flock state machine (BUSINESS_RULES §3.1). Only transitions reachable via
// the status endpoint are listed. PROCESSED is entered by a ProcessingEvent
// (BR-16), never by direct assignment, so it appears only as a *source* here.
export const ALLOWED_TRANSITIONS: Record<FlockStatus, FlockStatus[]> = {
  ACTIVE: ["INACTIVE"],
  INACTIVE: ["ACTIVE", "ARCHIVED"],
  PROCESSED: ["ARCHIVED"],
  ARCHIVED: [], // terminal
};

export function canTransition(from: FlockStatus, to: FlockStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

// days-to-processing = cycleLengthDays − days elapsed since startDate (BR metric).
// Null for layers (no cycle) — never a hardcoded 45 (BR-04).
export function daysToProcessing(flock: {
  cycleLengthDays: number | null;
  startDate: Date;
}): number | null {
  if (flock.cycleLengthDays == null) return null;
  const msPerDay = 86_400_000;
  const elapsed = Math.floor(
    (farmTodayUtcMidnight().getTime() - flock.startDate.getTime()) / msPerDay,
  );
  return flock.cycleLengthDays - elapsed;
}
