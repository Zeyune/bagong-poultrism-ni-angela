import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveActiveUser } from "@/lib/auth/resolve-user";
import { AuthError } from "@/lib/auth/errors";
import type { User } from "@prisma/client";

/**
 * The gate for every authenticated route. Verifies the request's JWT (ES256,
 * against Supabase's JWKS — no shared secret, see API.md §2), then resolves the
 * local User and enforces the BR-11 status check.
 *
 * Throws AuthError; route handlers convert it via handleRouteError().
 */
export async function requireUser(): Promise<User> {
  const supabase = await createSupabaseServerClient();

  // getClaims() validates the signature locally against the cached JWKS and
  // returns the token's claims. `sub` is the auth.users UUID.
  const { data, error } = await supabase.auth.getClaims();
  if (error) {
    throw new AuthError("UNAUTHENTICATED", "Missing, expired, or invalid token.");
  }

  return resolveActiveUser(data?.claims?.sub ?? null);
}
