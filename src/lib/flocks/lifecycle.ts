import type { FlockStatus } from "@prisma/client";

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

// Today's calendar date in the farm timezone, as a UTC-midnight Date so it can be
// differenced against a @db.Date (also stored at UTC midnight). Asia/Manila is a
// fixed +08:00 offset; a multi-timezone future would take the tz as a parameter.
function farmTodayUtcMidnight(timeZone = "Asia/Manila"): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return new Date(`${ymd}T00:00:00Z`);
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
