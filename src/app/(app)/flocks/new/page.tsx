import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { NewFlockForm } from "./new-flock-form";

// Creating a flock is Admin-only (POST /flocks). Guard the screen too, so a worker
// never reaches a form the API would reject — the 403 still stands as the backstop.
export default async function NewFlockPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/flocks");
  return <NewFlockForm />;
}
