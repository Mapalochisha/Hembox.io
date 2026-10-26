import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient as createAuthClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
function json(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }) }

export async function GET() {
  try {
    const auth = createAuthClient()
    const { data: { user }, error: authError } = await auth.auth.getUser()
    if (authError || !user) return json({ error: "Sign in to view your services." }, 401)
    const db = auth as unknown as SupabaseClient
    const { data, error } = await db.from("client_services")
      .select("id,client_id,project_id,service_type,name,description,status,starts_at,renews_at,currency,created_at,updated_at")
      .eq("customer_id", user.id).order("created_at", { ascending: false }).limit(200)
    if (error) throw error
    return json({ services: data ?? [] })
  } catch (error) {
    console.error("[Portal] Service inventory failed:", error)
    return json({ error: "The service inventory is not available yet. Please try again later." }, 503)
  }
}
