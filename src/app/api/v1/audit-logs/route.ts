import { requireAdmin } from "@/lib/auth/require-admin";
import { db } from "@/lib/db";
import { okPaginated, handleRouteError } from "@/lib/api/respond";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// GET /api/v1/audit-logs — Admin only, read-only (BR-65). Filters: entityType,
// entityId, userId, startDate/endDate. Paginated. There is deliberately no POST,
// PATCH, or DELETE: audit rows are immutable and are written only by the database
// trigger (FR-13.4).
export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(searchParams.get("limit") ?? "20", 10) || 20),
    );

    const where: Prisma.AuditLogWhereInput = { farmId: admin.farmId };
    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");
    const userId = searchParams.get("userId");
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (userId) where.userId = userId;

    // Dates are farm-local, inclusive at both ends (API.md §3.1). Asia/Manila is a
    // fixed +08:00 offset (no DST), so the boundary is exact for this farm; a
    // multi-timezone future would resolve the offset from Farm.timezone.
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(`${startDate}T00:00:00+08:00`);
      if (endDate) where.createdAt.lte = new Date(`${endDate}T23:59:59.999+08:00`);
    }

    const [items, totalItems] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.auditLog.count({ where }),
    ]);

    return okPaginated(items, {
      totalItems,
      currentPage: page,
      itemsPerPage: limit,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
