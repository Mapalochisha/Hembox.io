import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { DOMAIN_ORDER_STATUSES } from "@/lib/domains/order-state"

export const dynamic = "force-dynamic"

async function requireAdmin() {
  const authClient = createClient()
  const { data: { user }, error: userError } = await authClient.auth.getUser()
  if (userError || !user) return { status: 401 as const }
  const { data: role, error: roleError } = await authClient.rpc("get_user_role", { user_id: user.id })
  if (roleError) return { status: 503 as const }
  if (role !== "admin") return { status: 403 as const }
  return { status: 200 as const }
}

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.status !== 200) {
      const message = auth.status === 401 ? "Authentication required."
        : auth.status === 403 ? "Administrator access required."
        : "Unable to verify administrator access."
      return NextResponse.json({ error: message }, { status: auth.status })
    }

    const requestedStatus = new URL(request.url).searchParams.get("status")
    if (requestedStatus && !DOMAIN_ORDER_STATUSES.includes(requestedStatus as (typeof DOMAIN_ORDER_STATUSES)[number])) {
      return NextResponse.json({ error: "Unknown domain order status." }, { status: 400 })
    }

    const supabase = createServiceClient() as unknown as SupabaseClient
    let orderQuery = supabase
      .from("domain_orders")
      .select("id,customer_email,customer_name,domain_name,status,retail_currency,registration_retail_minor,renewal_retail_minor,wholesale_currency,registration_wholesale_minor,renewal_wholesale_minor,provider_id,provider_order_reference,registered_at,expires_at,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(100)
    if (requestedStatus) orderQuery = orderQuery.eq("status", requestedStatus)

    const { data: orders, error: orderError } = await orderQuery
    if (orderError) throw orderError

    const orderIds = (orders ?? []).map((order) => order.id)
    let auditEvents: unknown[] = []
    if (orderIds.length) {
      const { data, error } = await supabase
        .from("domain_audit_events")
        .select("id,order_id,event_type,details,created_at,actor_user_id")
        .in("order_id", orderIds)
        .order("created_at", { ascending: false })
        .limit(100)
      if (error) throw error
      auditEvents = data ?? []
    }

    return NextResponse.json({ orders: orders ?? [], auditEvents, statuses: DOMAIN_ORDER_STATUSES })
  } catch (error) {
    console.error("Admin domain order queue failed:", error)
    return NextResponse.json({ error: "Domain order queue is temporarily unavailable." }, { status: 503 })
  }
}
