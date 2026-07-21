import { describe, it, expect, afterAll, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { runWithActor } from "@/lib/audit/context";
import * as auditRoute from "@/app/api/v1/audit-logs/route";

// The signed-in principal, controllable per test. The audit-logs route runs
// through requireAdmin() → requireUser() → getClaims(); mocking only the Supabase
// server client lets the real authorization path (role check, BR-11 status check)
// run against real User rows in the database.
const authState = vi.hoisted(() => ({ sub: null as string | null }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getClaims: async () =>
        authState.sub
          ? { data: { claims: { sub: authState.sub } }, error: null }
          : { data: null, error: { message: "no session" } },
    },
  }),
}));

const FARM = "farm_dev_000000000000000";
const authIds: string[] = [];
const flockIds: string[] = [];

async function makeUser(role: "ADMIN" | "FARM_WORKER") {
  const authUserId = randomUUID();
  authIds.push(authUserId);
  const user = await db.user.create({
    data: {
      authUserId,
      email: `s4-${authUserId}@example.test`,
      name: `S4 ${role}`,
      role,
      status: "ACTIVE",
      farmId: FARM,
    },
  });
  return user;
}

afterAll(async () => {
  // Clean up test-created rows, including the audit rows they generated. Audit
  // rows are immutable to the APP (BR-65); a test cleaning its own fixtures via
  // Prisma directly is not the app and is fine.
  if (flockIds.length) {
    await db.auditLog.deleteMany({ where: { entityType: "Flock", entityId: { in: flockIds } } });
    await db.flock.deleteMany({ where: { id: { in: flockIds } } });
  }
  if (authIds.length) {
    const users = await db.user.findMany({ where: { authUserId: { in: authIds } } });
    const userIds = users.map((u) => u.id);
    await db.auditLog.deleteMany({
      where: { OR: [{ userId: { in: userIds } }, { entityId: { in: userIds } }] },
    });
    await db.user.deleteMany({ where: { authUserId: { in: authIds } } });
  }
  await db.$disconnect();
});

describe("Audit trail — FR-13", () => {
  it("FR-13.1: a create and an update record the actor, action, and before/after diff", async () => {
    const admin = await makeUser("ADMIN");

    // CREATE, inside the actor context.
    const flock = await runWithActor({ userId: admin.id, farmId: FARM }, () =>
      db.flock.create({
        data: {
          farmId: FARM,
          type: "BROILER",
          name: "Audit Test Flock",
          initialCount: 50,
          currentCount: 50,
          startDate: new Date("2026-07-01"),
        },
      }),
    );
    flockIds.push(flock.id);

    const createLog = await db.auditLog.findFirst({
      where: { entityType: "Flock", entityId: flock.id, action: "CREATE" },
    });
    expect(createLog).toBeTruthy();
    expect(createLog!.userId).toBe(admin.id);
    expect(createLog!.before).toBeNull();
    expect((createLog!.after as Record<string, unknown>).name).toBe("Audit Test Flock");

    // UPDATE, inside the actor context.
    await runWithActor({ userId: admin.id, farmId: FARM }, () =>
      db.flock.update({ where: { id: flock.id }, data: { currentCount: 48 } }),
    );

    const updateLog = await db.auditLog.findFirst({
      where: { entityType: "Flock", entityId: flock.id, action: "UPDATE" },
      orderBy: { createdAt: "desc" },
    });
    expect(updateLog).toBeTruthy();
    expect(updateLog!.userId).toBe(admin.id);
    expect((updateLog!.before as Record<string, unknown>).currentCount).toBe(50);
    expect((updateLog!.after as Record<string, unknown>).currentCount).toBe(48);
  });

  it("FR-13.2: an audit row still resolves to its actor after that actor is deactivated", async () => {
    const admin = await makeUser("ADMIN");
    const flock = await runWithActor({ userId: admin.id, farmId: FARM }, () =>
      db.flock.create({
        data: {
          farmId: FARM,
          type: "LAYER",
          name: "Actor Persistence Flock",
          initialCount: 20,
          currentCount: 20,
          startDate: new Date("2026-07-01"),
        },
      }),
    );
    flockIds.push(flock.id);

    // Deactivate the actor (BR-11 soft-deactivation — the row is not deleted).
    await db.user.update({ where: { id: admin.id }, data: { status: "DEACTIVATED" } });

    const log = await db.auditLog.findFirst({
      where: { entityType: "Flock", entityId: flock.id },
      include: { user: true },
    });
    expect(log!.userId).toBe(admin.id);
    // The identity still resolves — the User row survives, only its status changed.
    expect(log!.user).toBeTruthy();
    expect(log!.user!.status).toBe("DEACTIVATED");
    expect(log!.user!.name).toBe("S4 ADMIN");
  });

  it("FR-13.3: GET /audit-logs returns 403 for a FARM_WORKER", async () => {
    const worker = await makeUser("FARM_WORKER");
    authState.sub = worker.authUserId;

    const res = await auditRoute.GET(new Request("http://localhost/api/v1/audit-logs"));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
    authState.sub = null;
  });

  it("FR-13.3: GET /audit-logs returns rows in the paginated envelope for an Admin", async () => {
    const admin = await makeUser("ADMIN");
    authState.sub = admin.authUserId;

    const res = await auditRoute.GET(
      new Request("http://localhost/api/v1/audit-logs?limit=5"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toMatchObject({ currentPage: 1, itemsPerPage: 5 });
    authState.sub = null;
  });

  it("FR-13.4: the audit-logs route exposes no write handler (immutable, read-only)", () => {
    // Immutability enforced by absence: there is no POST/PATCH/PUT/DELETE to edit
    // or remove an audit row. Rows are written only by the database trigger.
    expect((auditRoute as Record<string, unknown>).POST).toBeUndefined();
    expect((auditRoute as Record<string, unknown>).PATCH).toBeUndefined();
    expect((auditRoute as Record<string, unknown>).PUT).toBeUndefined();
    expect((auditRoute as Record<string, unknown>).DELETE).toBeUndefined();
  });
});
