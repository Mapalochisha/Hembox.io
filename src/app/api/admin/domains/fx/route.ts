import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { refreshBozFxAndReprice } from "@/lib/domains/refresh-fx"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

async function adminStatus() {
  const auth = await createClient()
  const { data: { user }, error } = await auth.auth.getUser()
  if (error || !user) return 401
  const { data: role, error: roleError } = await auth.rpc("get_user_role", { user_id: user.id })
  if (roleError) return 503
  return role === "admin" ? 200 : 403
}

function errorResponse(status: number) {
  return NextResponse.json({ error: status === 401 ? "Authentication required." : status === 403 ? "Administrator access required." : "Unable to verify administrator access." }, { status })
}

export async function GET() {
  const status = await adminStatus()
  if (status !== 200) return errorResponse(status)
  const supabase = createServiceClient() as unknown as SupabaseClient
  const { data, error } = await supabase
    .from("domain_fx_rate_snapshots")
    .select("*")
    .eq("source", "bank-of-zambia")
    .eq("base_currency", "USD")
    .eq("quote_currency", "ZMW")
    .order("rate_date", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return NextResponse.json({ error: "Unable to load the latest FX snapshot." }, { status: 503 })
  return NextResponse.json({ snapshot: data ?? null }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST() {
  const status = await adminStatus()
  if (status !== 200) return errorResponse(status)
  try {
    const result = await refreshBozFxAndReprice()
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("Admin-triggered BoZ FX refresh failed:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "FX refresh failed." }, { status: 503 })
  }
}
