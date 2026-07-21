import { redirect } from "next/navigation";
import type { User } from "@prisma/client";
import { requireUser } from "@/lib/auth/require-user";

// Placeholder authed landing. The real dashboard is Step 8 (FR-06); for Step 3
// this only has to prove the round trip — a signed-in, ACTIVE user reaches an
// authenticated page, and anyone else is sent to sign-in. requireUser() applies
// the BR-11 status check here exactly as it does on the API routes.
export default async function Home() {
  let user: User;
  try {
    user = await requireUser();
  } catch {
    redirect("/sign-in");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 px-4 dark:bg-black">
      <div className="text-center">
        <p className="text-sm uppercase tracking-wide text-zinc-500">
          Signed in
        </p>
        <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          {user.name}
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {user.role} · {user.status}
        </p>
      </div>

      <form action="/auth/sign-out" method="post">
        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-4 py-2 text-base font-medium text-zinc-900 dark:border-zinc-700 dark:text-zinc-50"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
