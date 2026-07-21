// Supabase client for Server Components, Route Handlers, and Server Actions.
// Reads and writes the session cookies via @supabase/ssr. Cookie writes from a
// Server Component throw (cookies are read-only there); middleware.ts performs
// the refresh-and-write instead, so that case is swallowed deliberately.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requiredEnv } from "@/lib/supabase/config";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Component context — read-only cookies. middleware refreshes.
          }
        },
      },
    },
  );
}
