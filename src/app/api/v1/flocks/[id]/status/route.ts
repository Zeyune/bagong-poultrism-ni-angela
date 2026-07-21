import { db } from "@/lib/db";
import { withAdminActor } from "@/lib/auth/with-actor";
import { ok, fail, handleRouteError } from "@/lib/api/respond";
import { validationFail, readJson } from "@/lib/api/validation";
import { statusSchema } from "@/lib/validation/flock";
import { canTransition, ALLOWED_TRANSITIONS } from "@/lib/flocks/lifecycle";
import { serializeFlock } from "@/lib/flocks/serialize";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/v1/flocks/:id/status — change status (Admin), validated against the
// state machine (BR §3.1). Archiving is reached here (INACTIVE/PROCESSED → ARCHIVED);
// there is no delete (I-14).
export async function POST(request: Request, context: Ctx) {
  try {
    return await withAdminActor(async (admin) => {
      const { id } = await context.params;
      const parsed = statusSchema.safeParse(await readJson(request));
      if (!parsed.success) return validationFail(parsed.error);

      const flock = await db.flock.findFirst({
        where: { id, farmId: admin.farmId },
      });
      if (!flock) return fail("NOT_FOUND", "Flock not found.", { status: 404 });

      const target = parsed.data.status;
      if (!canTransition(flock.status, target)) {
        const allowed = ALLOWED_TRANSITIONS[flock.status];
        return fail(
          "UNPROCESSABLE",
          `Cannot change status from ${flock.status} to ${target}.` +
            (allowed.length
              ? ` Allowed from ${flock.status}: ${allowed.join(", ")}.`
              : ` ${flock.status} is terminal.`),
          { status: 422 },
        );
      }

      const updated = await db.flock.update({
        where: { id },
        data: { status: target },
      });
      return ok(serializeFlock(updated));
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
