// A typed authentication/authorization failure. Route handlers let it propagate
// to handleRouteError(), which maps `code` to the HTTP status in API.md §3.2.
// Only these two codes are ever thrown here: 401 for a token problem, 403 for an
// authenticated caller who is not permitted.

export class AuthError extends Error {
  constructor(
    public readonly code: "UNAUTHENTICATED" | "FORBIDDEN",
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}
