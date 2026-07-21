import { redirect, notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { serializeFlock } from "@/lib/flocks/serialize";
import { EditFlockForm } from "./edit-flock-form";

export const dynamic = "force-dynamic";

// Editing is Admin-only (PATCH /flocks/:id). Guard the screen; the API 403 is the
// backstop. type and currentCount are immutable (BR-02, BR-13) and are not fields
// on the form at all.
export default async function EditFlockPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/flocks");

  const { id } = await params;
  const [row, feedItems, growthCurves] = await Promise.all([
    db.flock.findFirst({ where: { id, farmId: user.farmId } }),
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
  if (!row) notFound();

  return (
    <EditFlockForm
      flock={serializeFlock(row)}
      feedItems={feedItems}
      growthCurves={growthCurves}
    />
  );
}
