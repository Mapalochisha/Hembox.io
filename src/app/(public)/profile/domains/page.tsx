import { redirect } from "next/navigation"

// Preserve old bookmarks while keeping domain management inside the client portal.
export default function ProfileDomainsRedirect() {
  redirect("/portal/domains")
}
