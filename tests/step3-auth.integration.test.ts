import { describe, it, expect, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { resolveActiveUser } from "@/lib/auth/resolve-user";
import { AuthError } from "@/lib/auth/errors";
import { GET as healthGET } from "@/app/api/v1/health/route";

// Integration — runs against the local Supabase Postgres. Prisma connects as the
// `postgres` superuser, which bypasses the G-65 RLS lockdown, so these inserts
// and reads work exactly as the application's server-side code does.
//
// Every user created here carries a unique random authUserId and a recognisable
// email, and is removed in afterAll.

const FARM = "farm_dev_000000000000000";
const createdAuthIds: string[] = [];

async function makeUser(
  status: "ACTIVE" | "INVITED" | "DEACTIVATED",
  role: "ADMIN" | "FARM_WORKER" = "FARM_WORKER",
): Promise<string> {
  const authUserId = randomUUID();
  createdAuthIds.push(authUserId);
  await db.user.create({
    data: {
      authUserId,
      email: `step3-${authUserId}@example.test`,
      name: "Step 3 Test User",
      role,
      status,
      farmId: FARM,
    },
  });
  return authUserId;
}

afterAll(async () => {
  if (createdAuthIds.length) {
    await db.user.deleteMany({ where: { authUserId: { in: createdAuthIds } } });
  }
  await db.$disconnect();
});

describe("resolveActiveUser — BR-11 / FR-10.7", () => {
  it("BR-11: an ACTIVE user resolves to their User row", async () => {
    const id = await makeUser("ACTIVE");
    const user = await resolveActiveUser(id);
    expect(user.authUserId).toBe(id);
    expect(user.status).toBe("ACTIVE");
  });

  it("FR-10.7: a user DEACTIVATED mid-session is rejected on the very next request, same token", async () => {
    const id = await makeUser("ACTIVE");

    // First request while active — allowed.
    await expect(resolveActiveUser(id)).resolves.toMatchObject({ status: "ACTIVE" });

    // Deactivated directly in the database. No new sign-in; the caller's token
    // is unchanged and still cryptographically valid.
    await db.user.update({
      where: { authUserId: id },
      data: { status: "DEACTIVATED" },
    });

    // Next request — rejected, because status is read fresh on every call rather
    // than trusted from the token. This is the whole point of BR-11.
    await expect(resolveActiveUser(id)).rejects.toBeInstanceOf(AuthError);
    await expect(resolveActiveUser(id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("BR-11: an INVITED user (invitation not yet accepted) is rejected with 403", async () => {
    const id = await makeUser("INVITED");
    await expect(resolveActiveUser(id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("FR-10.7: a validly-signed token with no provisioned User row is rejected with 403", async () => {
    await expect(resolveActiveUser(randomUUID())).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("FR-10.7: a missing/absent token is rejected with 401 UNAUTHENTICATED", async () => {
    await expect(resolveActiveUser(null)).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });
});

describe("GET /api/v1/health", () => {
  it("touches the database and reports healthy (keep-alive depends on the query)", async () => {
    const res = await healthGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("healthy");
  });
});
