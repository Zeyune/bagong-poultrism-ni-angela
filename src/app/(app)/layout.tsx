import Link from "next/link";
import { redirect } from "next/navigation";
import type { User } from "@prisma/client";
import { requireUser } from "@/lib/auth/require-user";

// Authenticated shell for every screen behind sign-in. The guard here means a
// deactivated user (BR-11) is bounced on their next navigation, not just at the
// API. Sign-in itself lives outside this group, so it is never guarded.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user: User;
  try {
    user = await requireUser();
  } catch {
    redirect("/sign-in");
  }

  return (
    <div className="flex min-h-full flex-col bg-bg">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link
              href="/flocks"
              className="font-heading text-lg font-bold text-primary"
            >
              PoultryPilot
            </Link>
            <nav aria-label="Main">
              <Link
                href="/flocks"
                className="text-sm font-semibold text-text-body hover:text-text"
              >
                Flocks
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-text-muted sm:inline">
              {user.name} · {user.role}
            </span>
            <form action="/auth/sign-out" method="post">
              <button
                type="submit"
                className="min-h-11 rounded-md border border-border-strong px-3 text-sm font-semibold text-text hover:bg-surface-sunken"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
