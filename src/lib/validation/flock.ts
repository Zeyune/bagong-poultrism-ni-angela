import { z } from "zod";
import { farmTodayDateString } from "@/lib/time";

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD.");

// YYYY-MM-DD compares lexicographically as a date, so a string <= today is
// today-or-past in farm-local time.
const notFuture = (s: string) => s <= farmTodayDateString();

// POST /flocks. currentCount is deliberately absent — it is system-maintained
// (BR-13), set to initialCount at creation. type is set here and never again (BR-02).
export const createFlockSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  type: z.enum(["LAYER", "BROILER"]),
  breed: z.string().trim().min(1).optional(),
  initialCount: z.number().int().positive("initialCount must be greater than 0."),
  // Start date cannot be in the future (USER_FLOWS §3.1).
  startDate: DATE.refine(notFuture, "Start date cannot be in the future."),
  // Broilers default to 45 (BR-04) if omitted; layers carry null.
  cycleLengthDays: z.number().int().positive().nullable().optional(),
  defaultFeedItemId: z.string().min(1).nullable().optional(),
  growthCurveId: z.string().min(1).nullable().optional(),
});

// PATCH /flocks/:id. .strict() rejects any key not listed — which is how `type`
// (BR-02) and `currentCount` (BR-13) are refused: sending either is a 400, and
// the entity is left unchanged (FR-01.3).
export const patchFlockSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    breed: z.string().trim().min(1).nullable().optional(),
    cycleLengthDays: z.number().int().positive().nullable().optional(),
    defaultFeedItemId: z.string().min(1).nullable().optional(),
    growthCurveId: z.string().min(1).nullable().optional(),
  })
  .strict();

// POST /flocks/:id/status. PROCESSED is intentionally excluded — a flock only
// becomes PROCESSED through a ProcessingEvent (BR-16, Phase 2), never by direct
// status assignment. The transition itself is validated against BR §3.1.
export const statusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]),
});

// POST /flocks/:id/birds — optional individual tagging (BR-17, FR-01.5).
export const createBirdSchema = z.object({
  tag: z.string().trim().min(1, "Tag is required."),
  hatchDate: DATE.optional(),
  notes: z.string().trim().min(1).nullable().optional(),
});
