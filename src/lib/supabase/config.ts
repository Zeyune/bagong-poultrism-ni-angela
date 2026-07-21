// The two public Supabase values, read with a loud failure if absent. Both are
// NEXT_PUBLIC_ and safe in the browser bundle; the presence gate is
// scripts/check-env.mjs, this is the runtime backstop.
//
// ⚠️ These MUST be referenced statically (a literal `process.env.NEXT_PUBLIC_…`),
//    not via a dynamic key. Next inlines NEXT_PUBLIC_* into the client bundle only
//    at literal member accesses; `process.env[name]` is not inlined and reads as
//    undefined in the browser — which is exactly the bug this shape prevents. The
//    object below captures the two literals once; the lookup is then a plain object
//    access that works identically on the server and in the browser.

type PublicVar = "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY";

const PUBLIC_ENV: Record<PublicVar, string | undefined> = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

export function requiredEnv(name: PublicVar): string {
  const value = PUBLIC_ENV[name];
  if (!value) {
    throw new Error(`${name} is not set — see .env.example.`);
  }
  return value;
}
