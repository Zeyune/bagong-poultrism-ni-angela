import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST /auth/sign-out — clears the Supabase session cookies and returns to
// sign-in. A route handler (not a Server Action) because signOut() must write
// cookies, which Server Components cannot.
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  // 303 so the browser follows with a GET to the sign-in page.
  return NextResponse.redirect(new URL("/sign-in", request.url), {
    status: 303,
  });
}
