import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { withAdminActor } from "@/lib/auth/with-actor";
import { ok, okPaginated, fail, handleRouteError } from "@/lib/api/respond";
import { validationFail, isUniqueViolation, readJson } from "@/lib/api/validation";
import { createFlockSchema } from "@/lib/validation/flock";
import { serializeFlock } from "@/lib/flocks/serialize";
import type { Prisma, FlockType, FlockStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

// POST /api/v1/flocks — create a flock (Admin). currentCount is set to initialCount
// by the system (BR-13); status starts ACTIVE (BR §3.1). The write runs inside the
// admin actor context, so the audit trigger attributes it.
export async function POST(request: Request) {
  try {
    return await withAdminActor(async (admin) => {
      const parsed = createFlockSchema.safeParse(await readJson(request));
      if (!parsed.success) return validationFail(parsed.error);
      const d = parsed.data;

      // Broilers default to a 45-day cycle (BR-04); layers have none.
      const cycleLengthDays =
        d.type === "BROILER" ? (d.cycleLengthDays ?? 45) : null;

      try {
        const flock = await db.flock.create({
          data: {
            farmId: admin.farmId,
            name: d.name,
            type: d.type,
            breed: d.breed ?? null,
            initialCount: d.initialCount,
            currentCount: d.initialCount,
            startDate: new Date(`${d.startDate}T00:00:00Z`),
            cycleLengthDays,
            defaultFeedItemId: d.defaultFeedItemId ?? null,
            growthCurveId: d.growthCurveId ?? null,
            status: "ACTIVE",
          },
        });
        return ok(serializeFlock(flock), { status: 201 });
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

// GET /api/v1/flocks — list the caller's farm's flocks (any active user), with
// optional status/type filters, paginated (API.md §3.1).
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(searchParams.get("limit") ?? "20", 10) || 20),
    );

    const where: Prisma.FlockWhereInput = { farmId: user.farmId };
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    if (status) where.status = status as FlockStatus;
    if (type) where.type = type as FlockType;

    const [items, totalItems] = await Promise.all([
      db.flock.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.flock.count({ where }),
    ]);

    return okPaginated(items.map(serializeFlock), {
      totalItems,
      currentPage: page,
      itemsPerPage: limit,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
