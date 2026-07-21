import { requireUser } from "@/lib/auth/require-user";
import { requireAdmin } from "@/lib/auth/require-admin";
import { runWithActor } from "@/lib/audit/context";
import type { User } from "@prisma/client";

// Wrappers for MUTATING route handlers. They authenticate (applying the BR-11
// status check), then run the handler inside the audit actor context so every
// database write it makes is attributed to this user (FR-13). Read-only routes
// don't need these — they can call requireUser()/requireAdmin() directly.
//
// Usage:
//   export const POST = (req) => withActor(async (user) => { …writes…; return ok(…) })

export function withActor<T>(fn: (user: User) => Promise<T>): Promise<T> {
  return requireUser().then((user) =>
    runWithActor({ userId: user.id, farmId: user.farmId }, () => fn(user)),
  );
}

export function withAdminActor<T>(fn: (user: User) => Promise<T>): Promise<T> {
  return requireAdmin().then((user) =>
    runWithActor({ userId: user.id, farmId: user.farmId }, () => fn(user)),
  );
}
