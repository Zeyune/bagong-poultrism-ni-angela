import type { ZodError } from "zod";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { fail, type FieldError } from "@/lib/api/respond";

// Zod parse failure → 400 VALIDATION_ERROR with per-field details (API.md §3).
export function validationFail(error: ZodError): NextResponse {
  const details: FieldError[] = error.issues.map((issue) => ({
    field: issue.path.length ? issue.path.join(".") : "(body)",
    message: issue.message,
  }));
  return fail("VALIDATION_ERROR", "The request body is invalid.", { details });
}

// Prisma unique-constraint violation (e.g. a duplicate flock name per farm, or a
// duplicate bird tag per flock) → the caller decides the 409 message.
export function isUniqueViolation(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
  );
}

// Parse a JSON request body, tolerating an absent or malformed one (returns null).
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
