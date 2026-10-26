import { redirect } from "next/navigation"

// Keep the existing authenticated domain workflow as the source of truth
// while exposing it from the unified client workspace navigation.
export default function PortalDomainsRedirect() {
  redirect("/profile/domains")
}
