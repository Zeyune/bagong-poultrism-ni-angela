// Farm-local "today". All day boundaries resolve against the farm timezone
// (a settled convention). Asia/Manila is a fixed +08:00; a multi-timezone future
// would take the farm's timezone as an argument rather than defaulting it.

export function farmTodayDateString(timeZone = "Asia/Manila"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// The same calendar day as a UTC-midnight Date, for differencing against a
// @db.Date column (also stored at UTC midnight).
export function farmTodayUtcMidnight(timeZone = "Asia/Manila"): Date {
  return new Date(`${farmTodayDateString(timeZone)}T00:00:00Z`);
}
