import { describe, it, expect, vi } from "vitest";
import { ok, fail, handleRouteError } from "@/lib/api/respond";
import { AuthError } from "@/lib/auth/errors";

// Pure unit tests — no database, no network. Asserts the envelope shape from
// docs/API.md §3 and the error-code → status mapping from §3.2.

describe("API envelope (API.md §3)", () => {
  it("ok() wraps data with success:true and an always-present warnings array", async () => {
    const res = ok({ id: "u1" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      data: { id: "u1" },
      warnings: [],
    });
  });

  it("ok() carries message and warnings when given (warnings are load-bearing)", async () => {
    const res = ok(
      { id: "log1" },
      { message: "Saved", warnings: [{ code: "NO_FEED_ITEM", message: "none configured" }] },
    );
    const body = await res.json();
    expect(body.message).toBe("Saved");
    expect(body.warnings).toEqual([{ code: "NO_FEED_ITEM", message: "none configured" }]);
  });

  it("fail() applies the documented status for each code (API.md §3.2)", () => {
    expect(fail("VALIDATION_ERROR", "x").status).toBe(400);
    expect(fail("UNAUTHENTICATED", "x").status).toBe(401);
    expect(fail("FORBIDDEN", "x").status).toBe(403);
    expect(fail("NOT_FOUND", "x").status).toBe(404);
    expect(fail("CONFLICT", "x").status).toBe(409);
    expect(fail("UNPROCESSABLE", "x").status).toBe(422);
    expect(fail("INTERNAL_ERROR", "x").status).toBe(500);
  });

  it("fail() allows a status override for documented domain cases", () => {
    expect(fail("INTERNAL_ERROR", "db down", { status: 503 }).status).toBe(503);
  });

  it("handleRouteError maps an AuthError to its code and status", async () => {
    const res = handleRouteError(new AuthError("FORBIDDEN", "nope"));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      success: false,
      error: { code: "FORBIDDEN", message: "nope" },
    });
  });

  it("handleRouteError turns an unknown error into a 500 without leaking it", async () => {
    // The stack detail must reach the server log, never the client body.
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = handleRouteError(new Error("secret stack detail"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(body)).not.toContain("secret stack detail");
    errSpy.mockRestore();
  });
});
