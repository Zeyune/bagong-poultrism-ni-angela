import { redirect } from "next/navigation";

// The dashboard (FR-06) is Step 8. Until it exists, the authenticated root sends
// the user to the first real screen.
export default function Home() {
  redirect("/flocks");
}
