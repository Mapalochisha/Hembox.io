import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { DOMAIN_ORDER_STATUSES } from "@/lib/domains/order-state"

export const dynamic = "force-dynamic"

const ORDER_COLUMNS = "id,customer_email,customer_name,domain_name,status,retail_currency,registration_retail_minor,renewal_retail_minor,wholesale_currency,registration_wholesale_minor,renewal_wholesale_minor,provider_id,provider_order_reference,registered_at,expires_at,created_at,updated_at"

type OrderRow = {
  id: string
  status: string
  billing_invoice_id?: string | null
}

async function requireAdmin() {
  const authClient = createClient()
  const { data: { user }, error: userError } = await authClient.auth.getUser()
  if (userError || !user) return { status: 401 as const }
  const { data: role, error: roleError } = await authClient.rpc("get_user_role", { user_id: user.id })
  if (roleError) return { status: 503 as const }
  if (role !== "admin") return { status: 403 as const }
  return { status: 200 as const }
}

function isMissingColumn(error: { code?: string } | null) {
  return error?.code === "42703" || error?.code === "PGRST204"
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

    // billing_invoice_id only exists once the unified billing bridge migration is
    // deployed. Fall back to the legacy column set instead of failing the queue.
    let includeBillingLink = true
    let orders: OrderRow[] = []
    let orderError: { code?: string } | null = null
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let orderQuery = supabase
        .from("domain_orders")
        .select(includeBillingLink ? `${ORDER_COLUMNS},billing_invoice_id` : ORDER_COLUMNS)
        .order("created_at", { ascending: false })
        .limit(100)
      if (requestedStatus) orderQuery = orderQuery.eq("status", requestedStatus)
      const result = await orderQuery
      orders = (result.data ?? []) as unknown as OrderRow[]
      orderError = result.error
      if (!orderError) break
      if (!includeBillingLink || !isMissingColumn(orderError)) break
      includeBillingLink = false
    }
    if (orderError) throw orderError

    const orderIds = orders.map((order) => order.id)
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

    // Read-only settlement visibility so an administrator can tell which orders
    // are actually paid in the shared ledger before recording a registration.
    const invoiceIds = Array.from(new Set(orders
      .map((order) => order.billing_invoice_id)
      .filter((value): value is string => typeof value === "string" && value.length > 0)))
    let paymentInvoices: unknown[] = []
    if (invoiceIds.length) {
      const { data, error } = await supabase
        .from("billing_invoices")
        .select("id,invoice_number,status,currency,total_minor,paid_at")
        .in("id", invoiceIds)
      if (error) {
        console.warn("Admin domain order billing invoice lookup failed:", { code: error.code ?? "unknown" })
      } else {
        paymentInvoices = data ?? []
      }
    }

    return NextResponse.json({
      orders,
      auditEvents,
      paymentInvoices,
      statuses: DOMAIN_ORDER_STATUSES,
      billingLinkAvailable: includeBillingLink,
    })
  } catch (error) {
    console.error("Admin domain order queue failed:", error)
    return NextResponse.json({ error: "Domain order queue is temporarily unavailable." }, { status: 503 })
  }
}
