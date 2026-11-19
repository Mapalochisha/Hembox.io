import { redirect } from "next/navigation"

// Pricing now belongs to each product page. Preserve old bookmarks by
// returning visitors to the service catalogue instead of a universal grid.
export default function PricingPage() {
  redirect("/#services")
}
