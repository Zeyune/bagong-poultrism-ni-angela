import { describe, it, expect, afterAll, beforeAll, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { runWithActor } from "@/lib/audit/context";
import * as flocks from "@/app/api/v1/flocks/route";
import * as flockId from "@/app/api/v1/flocks/[id]/route";
import * as status from "@/app/api/v1/flocks/[id]/status/route";
import * as birds from "@/app/api/v1/flocks/[id]/birds/route";

// Drive the routes with a mocked session (as in Step 4): only the Supabase server
// client is mocked, so the real authorization path — requireAdmin → requireUser →
// resolveActiveUser, and the audit actor context — runs against real rows.
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
let adminSub: string;
let workerSub: string;

function req(url: string, method = "GET", body?: unknown): Request {
  return new Request(url, {
    method,
    ...(body !== undefined
      ? { body: JSON.stringify(body), headers: { "content-type": "application/json" } }
      : {}),
  });
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

async function makeUser(role: "ADMIN" | "FARM_WORKER") {
  const authUserId = randomUUID();
  authIds.push(authUserId);
  await db.user.create({
    data: {
      authUserId,
      email: `s5-${authUserId}@example.test`,
      name: `S5 ${role}`,
      role,
      status: "ACTIVE",
      farmId: FARM,
    },
  });
  return authUserId;
}

// Create a flock through the API as the admin, tracking it for cleanup.
async function createFlock(body: Record<string, unknown>) {
  authState.sub = adminSub;
  const res = await flocks.POST(req("http://x/api/v1/flocks", "POST", body));
  const json = await res.json();
  if (res.status === 201) flockIds.push(json.data.id);
  return { res, json };
}

beforeAll(async () => {
  adminSub = await makeUser("ADMIN");
  workerSub = await makeUser("FARM_WORKER");
});

afterAll(async () => {
  const users = await db.user.findMany({ where: { authUserId: { in: authIds } } });
  const userIds = users.map((u) => u.id);
  const admin = users.find((u) => u.role === "ADMIN");
  // Delete inside the actor context: the flock delete cascades to Bird rows, and
  // the Bird audit trigger needs a farmId, which only the app.farm_id GUC supplies
  // for a farm-less table. (Production never hard-deletes a flock — FR-01.4.)
  if (flockIds.length && admin) {
    await runWithActor({ userId: admin.id, farmId: FARM }, () =>
      db.flock.deleteMany({ where: { id: { in: flockIds } } }),
    );
  }
  await db.auditLog.deleteMany({
    where: {
      OR: [
        { entityType: "Flock", entityId: { in: flockIds } },
        { entityType: "Bird" },
        { userId: { in: userIds } },
        { entityId: { in: userIds } },
      ],
    },
  });
  await db.user.deleteMany({ where: { authUserId: { in: authIds } } });
  await db.$disconnect();
});

describe("Flocks — FR-01", () => {
  it("FR-01.1: an Admin creates a flock; it starts ACTIVE with currentCount = initialCount", async () => {
    const { res, json } = await createFlock({
      name: `Layer ${randomUUID()}`,
      type: "LAYER",
      initialCount: 50,
      startDate: "2026-07-01",
    });
    expect(res.status).toBe(201);
    expect(json.data.currentCount).toBe(50);
    expect(json.data.status).toBe("ACTIVE");
    expect(json.data.cycleLengthDays).toBeNull(); // layers have no cycle
  });

  it("FR-01.1: a BROILER defaults to a 45-day cycle (BR-04)", async () => {
    const { json } = await createFlock({
      name: `Broiler ${randomUUID()}`,
      type: "BROILER",
      initialCount: 50,
      startDate: "2026-07-01",
    });
    expect(json.data.cycleLengthDays).toBe(45);
  });

  it("FR-01.2: a duplicate name in the same farm fails with 409", async () => {
    const name = `Dup ${randomUUID()}`;
    const first = await createFlock({ name, type: "LAYER", initialCount: 10, startDate: "2026-07-01" });
    expect(first.res.status).toBe(201);
    const second = await createFlock({ name, type: "LAYER", initialCount: 10, startDate: "2026-07-01" });
    expect(second.res.status).toBe(409);
    expect(second.json.error.code).toBe("CONFLICT");
  });

  it("FR-01.3: changing type is refused and the flock is unchanged", async () => {
    const { json } = await createFlock({
      name: `Immutable ${randomUUID()}`,
      type: "LAYER",
      initialCount: 10,
      startDate: "2026-07-01",
    });
    authState.sub = adminSub;
    const res = await flockId.PATCH(
      req(`http://x/api/v1/flocks/${json.data.id}`, "PATCH", { type: "BROILER" }),
      ctx(json.data.id),
    );
    expect(res.status).toBe(400);
    const after = await db.flock.findUniqueOrThrow({ where: { id: json.data.id } });
    expect(after.type).toBe("LAYER");
  });

  it("BR-13: currentCount is not writable via PATCH", async () => {
    const { json } = await createFlock({
      name: `Count ${randomUUID()}`,
      type: "LAYER",
      initialCount: 10,
      startDate: "2026-07-01",
    });
    authState.sub = adminSub;
    const res = await flockId.PATCH(
      req(`http://x/api/v1/flocks/${json.data.id}`, "PATCH", { currentCount: 999 }),
      ctx(json.data.id),
    );
    expect(res.status).toBe(400);
    const after = await db.flock.findUniqueOrThrow({ where: { id: json.data.id } });
    expect(after.currentCount).toBe(10);
  });

  it("FR-01.4: there is no DELETE route; archiving is the path", async () => {
    expect((flockId as Record<string, unknown>).DELETE).toBeUndefined();

    const { json } = await createFlock({
      name: `Archive ${randomUUID()}`,
      type: "LAYER",
      initialCount: 10,
      startDate: "2026-07-01",
    });
    authState.sub = adminSub;
    // ACTIVE → INACTIVE → ARCHIVED (BR §3.1)
    const toInactive = await status.POST(
      req("http://x", "POST", { status: "INACTIVE" }),
      ctx(json.data.id),
    );
    expect(toInactive.status).toBe(200);
    const toArchived = await status.POST(
      req("http://x", "POST", { status: "ARCHIVED" }),
      ctx(json.data.id),
    );
    expect(toArchived.status).toBe(200);
    expect((await toArchived.json()).data.status).toBe("ARCHIVED");
  });

  it("BR §3.1: an invalid transition (ACTIVE → ARCHIVED) is rejected with 422", async () => {
    const { json } = await createFlock({
      name: `BadTransition ${randomUUID()}`,
      type: "LAYER",
      initialCount: 10,
      startDate: "2026-07-01",
    });
    authState.sub = adminSub;
    const res = await status.POST(
      req("http://x", "POST", { status: "ARCHIVED" }),
      ctx(json.data.id),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("UNPROCESSABLE");
  });

  it("FR-01.5/01.6: bird tags are unique per flock, not globally", async () => {
    const a = await createFlock({ name: `BirdsA ${randomUUID()}`, type: "LAYER", initialCount: 10, startDate: "2026-07-01" });
    const b = await createFlock({ name: `BirdsB ${randomUUID()}`, type: "LAYER", initialCount: 10, startDate: "2026-07-01" });
    authState.sub = adminSub;

    const first = await birds.POST(req("http://x", "POST", { tag: "B-001" }), ctx(a.json.data.id));
    expect(first.status).toBe(201);
    // FR-01.5: same tag, same flock → 409
    const dup = await birds.POST(req("http://x", "POST", { tag: "B-001" }), ctx(a.json.data.id));
    expect(dup.status).toBe(409);
    // FR-01.6: same tag, different flock → 201
    const other = await birds.POST(req("http://x", "POST", { tag: "B-001" }), ctx(b.json.data.id));
    expect(other.status).toBe(201);
  });

  it("authz: a FARM_WORKER cannot create a flock (403)", async () => {
    authState.sub = workerSub;
    const res = await flocks.POST(
      req("http://x/api/v1/flocks", "POST", { name: "Nope", type: "LAYER", initialCount: 10, startDate: "2026-07-01" }),
    );
    expect(res.status).toBe(403);
    authState.sub = null;
  });

  it("FR-13 (live endpoint): creating a flock writes an audit row attributed to the admin", async () => {
    const admin = await db.user.findFirstOrThrow({ where: { authUserId: adminSub } });
    const { json } = await createFlock({
      name: `Audited ${randomUUID()}`,
      type: "LAYER",
      initialCount: 10,
      startDate: "2026-07-01",
    });
    const log = await db.auditLog.findFirst({
      where: { entityType: "Flock", entityId: json.data.id, action: "CREATE" },
    });
    expect(log).toBeTruthy();
    expect(log!.userId).toBe(admin.id); // withAdminActor carried the actor through the real route
  });
});
