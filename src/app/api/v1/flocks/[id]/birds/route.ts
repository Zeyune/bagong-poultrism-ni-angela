import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { withAdminActor } from "@/lib/auth/with-actor";
import { ok, okPaginated, fail, handleRouteError } from "@/lib/api/respond";
import { validationFail, isUniqueViolation, readJson } from "@/lib/api/validation";
import { createBirdSchema } from "@/lib/validation/flock";
import { serializeBird } from "@/lib/flocks/serialize";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/v1/flocks/:id/birds — tag an individual bird (Admin). Tags are unique
// within a flock, not globally (BR-17): the same tag in another flock is fine, a
// repeat in this flock is a 409.
export async function POST(request: Request, context: Ctx) {
  try {
    return await withAdminActor(async (admin) => {
      const { id } = await context.params;
      const parsed = createBirdSchema.safeParse(await readJson(request));
      if (!parsed.success) return validationFail(parsed.error);

      const flock = await db.flock.findFirst({
        where: { id, farmId: admin.farmId },
      });
      if (!flock) return fail("NOT_FOUND", "Flock not found.", { status: 404 });

      const d = parsed.data;
      try {
        const bird = await db.bird.create({
          data: {
            flockId: id,
            tag: d.tag,
            hatchDate: d.hatchDate ? new Date(`${d.hatchDate}T00:00:00Z`) : null,
            notes: d.notes ?? null,
          },
        });
        return ok(serializeBird(bird), { status: 201 });
      } catch (e) {
        if (isUniqueViolation(e)) {
          return fail("CONFLICT", `Tag "${d.tag}" is already used in this flock.`, {
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

// GET /api/v1/flocks/:id/birds — list a flock's tagged birds (any active user).
export async function GET(request: Request, context: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await context.params;

    const flock = await db.flock.findFirst({ where: { id, farmId: user.farmId } });
    if (!flock) return fail("NOT_FOUND", "Flock not found.", { status: 404 });

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(searchParams.get("limit") ?? "20", 10) || 20),
    );

    const [items, totalItems] = await Promise.all([
      db.bird.findMany({
        where: { flockId: id },
        orderBy: { tag: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.bird.count({ where: { flockId: id } }),
    ]);

    return okPaginated(items.map(serializeBird), {
      totalItems,
      currentPage: page,
      itemsPerPage: limit,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
