import { redirect } from "next/navigation"

// Account details and preferences live inside the authenticated client workspace.
export default function ProfileRedirect() {
  redirect("/portal/settings")
}
