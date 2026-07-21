// Prisma client, configured for Vercel serverless against Supabase.
//
// Prisma 7 requires a driver adapter. @prisma/adapter-pg uses node-pg rather than
// the Rust query engine, which meaningfully reduces serverless cold start — see
// docs/GAPS.md G-75.
//
// Connection rules (docs/DATABASE.md § Supabase Integration):
//   • Runtime uses the POOLER, port 6543, transaction mode.
//   • ?pgbouncer=true disables prepared statements, which transaction mode cannot support.
//   • connection_limit=1 — each function instance holds one connection, not a pool
//     it will never reuse.
//
// ⚠️ Transaction mode does NOT preserve session state. Advisory locks are lost at the
//    transaction boundary and MUST NOT be used (invariant I-15). Row locks taken with
//    SELECT … FOR UPDATE inside a transaction are transaction-scoped and are fine.
//    Advisory locks appear to work locally against a direct connection and fail
//    silently in production.

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { getActor } from "@/lib/audit/context";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. It must be the Supabase pooler URL (port 6543) " +
      "with ?pgbouncer=true&connection_limit=1 — see .env.example.",
  );
}

// Write operations whose actor must be recorded by the audit trigger (FR-13).
const WRITE_OPS = new Set([
  "create",
  "update",
  "delete",
  "upsert",
  "createMany",
  "updateMany",
  "deleteMany",
]);

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString });
  const base = new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["error"],
  });

  // Audit actor bridge (FR-13). The AuditLog row itself is written by a database
  // trigger (supabase/sql/040_audit_trigger.sql); this extension's only job is to
  // hand that trigger the actor. For each write with an active request context, it
  // sets the app.user_id / app.farm_id GUCs transaction-locally and runs the write
  // in that same transaction, so the trigger firing inside it sees who acted.
  //
  // Writes with no actor context (seeds, tests, system tasks) pass straight through;
  // the trigger still audits them, with a null actor.
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const actor = getActor();
          if (!actor || !WRITE_OPS.has(operation)) {
            return query(args);
          }
          const delegate = model.charAt(0).toLowerCase() + model.slice(1);
          return base.$transaction(async (tx) => {
            await tx.$queryRaw`select
              set_config('app.user_id', ${actor.userId}, true),
              set_config('app.farm_id', ${actor.farmId}, true)`;
            // Re-issue the operation on the transaction client (unextended, so no
            // re-entry into this hook) so the write and its trigger share the tx.
            return (
              tx as unknown as Record<
                string,
                Record<string, (a: unknown) => unknown>
              >
            )[delegate][operation](args);
          });
        },
      },
    },
  });
}

// Reuse the client across hot reloads in development, and across warm invocations
// of the same serverless instance in production. Without this, every reload leaks
// a connection.
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
