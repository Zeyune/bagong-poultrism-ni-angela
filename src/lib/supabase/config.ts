// The two public Supabase values, read with a loud failure if absent. Both are
// NEXT_PUBLIC_ and safe in the browser bundle; the presence gate is
// scripts/check-env.mjs, this is the runtime backstop.

type PublicVar = "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY";

export function requiredEnv(name: PublicVar): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set — see .env.example.`);
  }
  return value;
}
