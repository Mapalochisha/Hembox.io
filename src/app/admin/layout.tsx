import { AdminLayoutClient } from "./admin-layout-client"

// Admin pages use server-side Supabase service credentials at request time.
// Keep this route segment dynamic so production builds do not try to prerender it.
export const dynamic = "force-dynamic"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>
}
