// Supabase client for Client Components (the sign-in form). Runs in the browser
// and reads the same cookie session written by the server client and middleware.

import { createBrowserClient } from "@supabase/ssr";
import { requiredEnv } from "@/lib/supabase/config";

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  );
}
