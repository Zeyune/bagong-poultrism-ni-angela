import { requireUser } from "@/lib/auth/require-user";
import { AuthError } from "@/lib/auth/errors";
import type { User } from "@prisma/client";

/**
 * Require an authenticated, ACTIVE user who is also an ADMIN. Builds on
 * requireUser(), so the BR-11 status check runs first, then the role check.
 */
export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new AuthError("FORBIDDEN", "This action requires an administrator.");
  }
  return user;
}
