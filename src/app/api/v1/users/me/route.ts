import { requireUser } from "@/lib/auth/require-user";
import { ok, handleRouteError } from "@/lib/api/respond";

// Uses cookies via requireUser(), so it is always dynamic; declared explicitly
// so no build step ever tries to statically cache it.
export const dynamic = "force-dynamic";

/** GET /api/v1/users/me — the authenticated caller's own User record. */
export async function GET() {
  try {
    const user = await requireUser();
    return ok({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      farmId: user.farmId,
      lastLoginAt: user.lastLoginAt,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
