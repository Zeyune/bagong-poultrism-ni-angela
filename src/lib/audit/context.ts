// Per-request actor context for the audit trail (FR-13).
//
// A Prisma extension is global, but the acting user is per-request. AsyncLocalStorage
// carries the actor across await boundaries within a request so the extension can
// read it without every call site threading it through. Set by withActor()
// (src/lib/auth/with-actor.ts) at the top of a mutating request; read by the audit
// extension in src/lib/db.ts.

import { AsyncLocalStorage } from "node:async_hooks";

export type AuditActor = {
  /** The acting User.id (uuid) — becomes AuditLog.userId via the trigger's GUC. */
  userId: string;
  /** The acting user's farmId — becomes AuditLog.farmId. */
  farmId: string;
};

const storage = new AsyncLocalStorage<AuditActor>();

export function runWithActor<T>(actor: AuditActor, fn: () => Promise<T>): Promise<T> {
  // Must `await fn()` INSIDE the run callback, not return it unawaited. Prisma's
  // promises are lazy: `db.x.create()` only schedules work when awaited, and if
  // that await happens after run() has returned, the extension hook executes
  // outside this context and getActor() sees nothing. Awaiting here keeps the
  // whole operation — hook included — within the actor context.
  return storage.run(actor, async () => await fn());
}

export function getActor(): AuditActor | undefined {
  return storage.getStore();
}
