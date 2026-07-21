import { db } from "@/lib/db";
import { ok, fail } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/health — public, unauthenticated liveness check.
 *
 * It MUST issue a database query. The keep-alive workflow calls this on a
 * schedule specifically to stop Supabase pausing the database for inactivity on
 * the free tier; a static 200 would keep Vercel warm while letting the database
 * go idle, defeating the purpose. See PHASE1_PLAN.md Step 3.
 */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return ok({ status: "healthy" });
  } catch {
    // 503 rather than the code's default 500: the service is up but a dependency
    // is unreachable, which is what a load balancer / uptime check needs to see.
    return fail("INTERNAL_ERROR", "Database is unreachable.", { status: 503 });
  }
}
