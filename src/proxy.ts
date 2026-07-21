// Session refresh. On every matched request this rotates the Supabase access
// token when it is near expiry and writes the updated cookies onto the response,
// so Server Components downstream see a fresh session. It performs no
// authorization — requireUser() does that per request against the database.
//
// Next 16 renamed the "middleware" file convention to "proxy"; the function is
// exported as `proxy` accordingly. Behaviour is unchanged — it still runs at the
// Edge before the matched routes.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { requiredEnv } from "@/lib/supabase/config";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getClaims() verifies the ES256 signature against JWKS locally and refreshes
  // via the Auth server only when the token is expiring. Its side effect — the
  // rotated cookies on `response` — is the point; the return value is unused here.
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and static assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
