import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { withAdminActor } from "@/lib/auth/with-actor";
import { ok, fail, handleRouteError } from "@/lib/api/respond";
import { validationFail, isUniqueViolation, readJson } from "@/lib/api/validation";
import { patchFlockSchema } from "@/lib/validation/flock";
import { serializeFlock } from "@/lib/flocks/serialize";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/v1/flocks/:id — detail (any active user). A flock outside the caller's
// farm is a 404, not a 403 — its existence is not disclosed (API.md §3.2).
export async function GET(_request: Request, context: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const flock = await db.flock.findFirst({ where: { id, farmId: user.farmId } });
    if (!flock) return fail("NOT_FOUND", "Flock not found.", { status: 404 });
    return ok(serializeFlock(flock));
  } catch (e) {
    return handleRouteError(e);
  }
}

// PATCH /api/v1/flocks/:id — edit (Admin). type (BR-02) and currentCount (BR-13)
// are refused by the strict schema, leaving the flock unchanged (FR-01.3).
export async function PATCH(request: Request, context: Ctx) {
  try {
    return await withAdminActor(async (admin) => {
      const { id } = await context.params;
      const parsed = patchFlockSchema.safeParse(await readJson(request));
      if (!parsed.success) return validationFail(parsed.error);

      const existing = await db.flock.findFirst({
        where: { id, farmId: admin.farmId },
      });
      if (!existing) return fail("NOT_FOUND", "Flock not found.", { status: 404 });

      const d = parsed.data;

      // Same referential guards as create: growth curves are broiler-only, and a
      // referenced feed item / growth curve must exist in this farm (422, not a
      // raw FK 500). type is immutable, so `existing.type` is authoritative.
      if (d.growthCurveId && existing.type !== "BROILER") {
        return fail(
          "UNPROCESSABLE",
          "A growth curve applies to broiler flocks only.",
          { status: 422 },
        );
      }
      if (d.defaultFeedItemId) {
        const feed = await db.inventoryItem.findFirst({
          where: { id: d.defaultFeedItemId, farmId: admin.farmId, type: "FEED" },
        });
        if (!feed) {
          return fail("UNPROCESSABLE", "The selected feed item was not found.", {
            status: 422,
          });
        }
      }
      if (d.growthCurveId) {
        const gc = await db.growthCurve.findFirst({
          where: { id: d.growthCurveId, farmId: admin.farmId },
        });
        if (!gc) {
          return fail("UNPROCESSABLE", "The selected growth curve was not found.", {
            status: 422,
          });
        }
      }

      try {
        const flock = await db.flock.update({
          where: { id },
          data: {
            ...(d.name !== undefined && { name: d.name }),
            ...(d.breed !== undefined && { breed: d.breed }),
            ...(d.cycleLengthDays !== undefined && {
              cycleLengthDays: d.cycleLengthDays,
            }),
            ...(d.defaultFeedItemId !== undefined && {
              defaultFeedItemId: d.defaultFeedItemId,
            }),
            ...(d.growthCurveId !== undefined && {
              growthCurveId: d.growthCurveId,
            }),
          },
        });
        return ok(serializeFlock(flock));
      } catch (e) {
        if (isUniqueViolation(e)) {
          return fail("CONFLICT", "A flock with this name already exists.", {
            status: 409,
          });
        }
        throw e;
      }
    });
  } catch (e) {
    return handleRouteError(e);
  }
}

// There is deliberately no DELETE handler: a flock is never hard-deleted while
// logs reference it (I-14, FR-01.4). Archiving via POST /:id/status is the path.
