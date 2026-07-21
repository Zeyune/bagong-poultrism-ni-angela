import { db } from "@/lib/db";
import { AuthError } from "@/lib/auth/errors";
import type { User } from "@prisma/client";

/**
 * Resolve the local User for a verified auth-user id, enforcing BR-11.
 *
 * The authorization decision is made against the CURRENT database row on every
 * call — never cached in the token. Supabase access tokens stay valid until they
 * expire (up to an hour), so a user deactivated mid-session still holds a working
 * token; reading `status` fresh here is what rejects them on their very next
 * request rather than an hour later.
 *
 * Split out from requireUser() so it can be tested directly against the database
 * without a cookie session or HTTP layer — this is where BR-11 lives.
 */
export async function resolveActiveUser(
  authUserId: string | null | undefined,
): Promise<User> {
  if (!authUserId) {
    throw new AuthError("UNAUTHENTICATED", "Missing, expired, or invalid token.");
  }

  const user = await db.user.findUnique({ where: { authUserId } });

  if (!user) {
    // The token is validly signed, but no User row was ever provisioned for it —
    // e.g. a self-signup the BR-10 trigger declined for carrying no invitation
    // metadata. The caller is authenticated but not authorized to act: 403, not
    // 401 (their token is fine; re-authenticating would not help).
    throw new AuthError(
      "FORBIDDEN",
      "No active user is associated with this account.",
    );
  }

  if (user.status !== "ACTIVE") {
    throw new AuthError("FORBIDDEN", "This account is not active.");
  }

  return user;
}
