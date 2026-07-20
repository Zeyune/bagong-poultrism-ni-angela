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

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. It must be the Supabase pooler URL (port 6543) " +
      "with ?pgbouncer=true&connection_limit=1 — see .env.example.",
  );
}

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["error"],
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
