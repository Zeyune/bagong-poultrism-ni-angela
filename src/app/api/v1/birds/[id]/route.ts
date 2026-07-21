import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { withAdminActor } from "@/lib/auth/with-actor";
import { ok, fail, handleRouteError } from "@/lib/api/respond";
import { validationFail, isUniqueViolation, readJson } from "@/lib/api/validation";
import { patchBirdSchema } from "@/lib/validation/flock";
import { serializeBird } from "@/lib/flocks/serialize";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// A bird is scoped to the caller's farm through its flock — a bird in another
// farm is a 404, never disclosed (API.md §3.2).
const inFarm = (id: string, farmId: string) => ({
  id,
  flock: { farmId },
});

// GET /api/v1/birds/:id — any active user (API.md §6.1).
export async function GET(_request: Request, context: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const bird = await db.bird.findFirst({ where: inFarm(id, user.farmId) });
    if (!bird) return fail("NOT_FOUND", "Bird not found.", { status: 404 });
    return ok(serializeBird(bird));
  } catch (e) {
    return handleRouteError(e);
  }
}

// PATCH /api/v1/birds/:id — edit tag / hatch date / notes (Admin). Tag stays
// unique within the flock (BR-17); a clash returns 409.
export async function PATCH(request: Request, context: Ctx) {
  try {
    return await withAdminActor(async (admin) => {
      const { id } = await context.params;
      const parsed = patchBirdSchema.safeParse(await readJson(request));
      if (!parsed.success) return validationFail(parsed.error);

      const existing = await db.bird.findFirst({
        where: inFarm(id, admin.farmId),
      });
      if (!existing) return fail("NOT_FOUND", "Bird not found.", { status: 404 });

      const d = parsed.data;
      try {
        const bird = await db.bird.update({
          where: { id },
          data: {
            ...(d.tag !== undefined && { tag: d.tag }),
            ...(d.hatchDate !== undefined && {
              hatchDate: d.hatchDate ? new Date(`${d.hatchDate}T00:00:00Z`) : null,
            }),
            ...(d.notes !== undefined && { notes: d.notes }),
          },
        });
        return ok(serializeBird(bird));
      } catch (e) {
        if (isUniqueViolation(e)) {
          return fail(
            "CONFLICT",
            `Tag "${d.tag}" is already used in this flock.`,
            { status: 409 },
          );
        }
        throw e;
      }
    });
  } catch (e) {
    return handleRouteError(e);
  }
}

// DELETE /api/v1/birds/:id — remove a tagged bird (Admin). Unlike a flock, an
// individual bird carries no dependent history (mortality is flock-level, G-45),
// so a hard delete is safe; the audit trigger records it via the actor context.
export async function DELETE(_request: Request, context: Ctx) {
  try {
    return await withAdminActor(async (admin) => {
      const { id } = await context.params;
      const existing = await db.bird.findFirst({
        where: inFarm(id, admin.farmId),
      });
      if (!existing) return fail("NOT_FOUND", "Bird not found.", { status: 404 });

      await db.bird.delete({ where: { id } });
      return new NextResponse(null, { status: 204 });
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
