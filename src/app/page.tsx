import { redirect } from "next/navigation";

export default function HomePage() {
  // The shared landing/"choose role" screen is gone.
  // The root URL sends everyone straight to the team portal.
  redirect("/team");
}
