// The API response envelope from docs/API.md §3. Every route returns through
// these helpers so the success/error/warnings shape is identical everywhere.

import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/errors";

export type Warning = { code: string; message: string; detail?: unknown };
export type FieldError = { field: string; message: string };

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNPROCESSABLE"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

// Default HTTP status per error code (docs/API.md §3.2). A caller may override
// for the documented domain cases (e.g. a 503 on the health check).
const DEFAULT_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

export function ok<T>(
  data: T,
  opts: { message?: string; warnings?: Warning[]; status?: number } = {},
): NextResponse {
  const body: Record<string, unknown> = { success: true, data };
  if (opts.message) body.message = opts.message;
  // warnings is always present, defaulting to [] — it is load-bearing (API.md §3)
  // and clients read it unconditionally.
  body.warnings = opts.warnings ?? [];
  return NextResponse.json(body, { status: opts.status ?? 200 });
}

export function okPaginated<T>(
  data: T[],
  page: { totalItems: number; currentPage: number; itemsPerPage: number },
): NextResponse {
  const totalPages = Math.max(1, Math.ceil(page.totalItems / page.itemsPerPage));
  return NextResponse.json({
    success: true,
    data,
    pagination: {
      totalItems: page.totalItems,
      totalPages,
      currentPage: page.currentPage,
      itemsPerPage: page.itemsPerPage,
    },
  });
}

export function fail(
  code: ErrorCode,
  message: string,
  opts: { details?: FieldError[]; status?: number } = {},
): NextResponse {
  const error: Record<string, unknown> = { code, message };
  if (opts.details) error.details = opts.details;
  return NextResponse.json(
    { success: false, error },
    { status: opts.status ?? DEFAULT_STATUS[code] },
  );
}

// Single catch-point for route handlers. Typed auth failures map to their code;
// anything else is an unexpected 500 and is logged, never leaked to the client.
export function handleRouteError(e: unknown): NextResponse {
  if (e instanceof AuthError) {
    return fail(e.code, e.message);
  }
  console.error("Unhandled route error:", e);
  return fail("INTERNAL_ERROR", "An unexpected error occurred.");
}
