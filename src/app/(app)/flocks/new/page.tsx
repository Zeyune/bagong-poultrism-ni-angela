import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { farmTodayDateString } from "@/lib/time";
import { NewFlockForm } from "./new-flock-form";

export const dynamic = "force-dynamic";

// Creating a flock is Admin-only (POST /flocks). Guard the screen; the API 403 is
// the backstop. The feed-item and growth-curve options come from the farm's own
// data — read here (no inventory API exists until Step 7) and passed to the form.
export default async function NewFlockPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/flocks");

  const [feedItems, growthCurves] = await Promise.all([
    db.inventoryItem.findMany({
      where: { farmId: user.farmId, type: "FEED", isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.growthCurve.findMany({
      where: { farmId: user.farmId },
      select: { id: true, name: true, breed: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <NewFlockForm
      feedItems={feedItems}
      growthCurves={growthCurves}
      today={farmTodayDateString()}
    />
  );
}
