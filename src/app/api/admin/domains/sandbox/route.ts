import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { createNameSiloSandboxOperations } from "@/lib/domains/providers/namesilo-sandbox-operations"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })

async function adminContext() {
  const auth = createClient()
  const { data: { user }, error } = await auth.auth.getUser()
  if (error || !user) return { status: 401 as const }
  const { data: role, error: roleError } = await auth.rpc("get_user_role", { user_id: user.id })
  if (roleError) return { status: 503 as const }
  if (role !== "admin") return { status: 403 as const }
  return { status: 200 as const, user }
}

export async function GET() {
  if (process.env.DOMAIN_PROVIDER_MODE?.trim().toLowerCase() !== "namesilo-sandbox") return json({ error: "Sandbox operations are disabled." }, 404)
  const auth = await adminContext()
  if (auth.status !== 200) return json({ error: auth.status === 401 ? "Authentication required." : auth.status === 403 ? "Administrator access required." : "Unable to verify administrator access." }, auth.status)
  try {
    const db = createServiceClient() as unknown as SupabaseClient
    const { data, error } = await db.from("domain_sandbox_orders")
      .select("id,customer_id,domain_name,term_years,status,payment_mode,payment_status,provider_environment,provider_code,provider_order_reference,provider_order_amount,registered_at,expires_at,nameservers,last_provider_check_at,last_provider_message,created_at")
      .order("created_at", { ascending: false }).limit(100)
    if (error) throw error
    return json({ orders: data ?? [], environment: "test", live: false })
  } catch {
    return json({ error: "Sandbox orders are unavailable. Apply the sandbox migration before testing." }, 503)
  }
}

export async function POST(request: Request) {
  if (process.env.DOMAIN_PROVIDER_MODE?.trim().toLowerCase() !== "namesilo-sandbox") return json({ error: "Sandbox operations are disabled." }, 404)
  const auth = await adminContext()
  if (auth.status !== 200) return json({ error: auth.status === 401 ? "Authentication required." : auth.status === 403 ? "Administrator access required." : "Unable to verify administrator access." }, auth.status)
  const body = await request.json().catch(() => null) as { orderId?: unknown; action?: unknown } | null
  if (!body || !["reconcile", "reset_if_unregistered"].includes(String(body.action)) || typeof body.orderId !== "string") return json({ error: "Provide an order id and a supported reconciliation action." }, 400)
  try {
    const db = createServiceClient() as unknown as SupabaseClient
    const { data: order, error } = await db.from("domain_sandbox_orders")
      .select("id,domain_name,status,registered_at,expires_at,nameservers")
      .eq("id", body.orderId).maybeSingle()
    if (error) throw error
    if (!order) return json({ error: "Sandbox order not found." }, 404)
    if (!["registration_pending", "registration_unknown"].includes(order.status)) return json({ error: "Only pending or ambiguous registrations can be reconciled." }, 409)

    const operations = createNameSiloSandboxOperations()
    const info = await operations.getDomainInfo(order.domain_name)
    if (body.action === "reset_if_unregistered") {
      if (!["registration_pending", "registration_unknown", "registration_failed"].includes(order.status)) return json({ error: "Only pending, ambiguous or failed registrations can be reset." }, 409)
      const availability = await operations.checkAvailability([order.domain_name])
      if (info.state !== "unknown" || info.providerCode !== 200 || availability[0]?.availability !== "available") {
        return json({ error: "OTE has not independently confirmed that registration did not occur. The order remains held; do not retry." }, 409)
      }
      const { error: resetError } = await db.from("domain_sandbox_orders").update({
        status: "quoted", provider_code: null, provider_order_amount: null,
        last_provider_check_at: new Date().toISOString(),
        last_provider_message: "Administrator confirmed the domain is not active in OTE and currently available; a controlled retry is permitted.",
      }).eq("id", order.id)
      if (resetError) throw resetError
      await db.from("domain_sandbox_events").insert({ order_id: order.id, actor_user_id: auth.user.id, event_type: "registration_retry_authorized", details: { provider_code: info.providerCode, availability: availability[0]?.availability, admin_confirmed: true } })
      return json({ reset: true, orderId: order.id, message: "OTE confirms no active registration and fresh availability. The customer may retry from their sandbox portfolio." })
    }

    const expiry = info.expiresAt ? Date.parse(info.expiresAt) : Number.NaN
    if (info.state !== "found" || info.providerStatus?.toLowerCase() !== "active" || !Number.isFinite(expiry) || expiry <= Date.now()) {
      return json({ reconciled: false, providerInfo: info, message: "The OTE account has not yet confirmed an active registration. The order remains held; do not retry registerDomain." }, 202)
    }
    const expiresAt = new Date(expiry).toISOString()
    const registeredAt = info.createdAt && Number.isFinite(Date.parse(info.createdAt)) ? new Date(info.createdAt).toISOString() : new Date().toISOString()
    const { error: updateError } = await db.from("domain_sandbox_orders").update({
      status: "registered", registered_at: registeredAt, expires_at: expiresAt,
      nameservers: info.nameservers, last_provider_check_at: new Date().toISOString(),
      last_provider_message: "Administrator reconciliation confirmed active ownership in NameSilo OTE.",
    }).eq("id", order.id)
    if (updateError) throw updateError
    await db.from("domain_sandbox_events").insert({ order_id: order.id, actor_user_id: auth.user.id, event_type: "registration_reconciled", details: { admin_reconciled: true, expires_at: expiresAt, nameservers: info.nameservers } })
    return json({ reconciled: true, orderId: order.id, expiresAt, nameservers: info.nameservers })
  } catch {
    return json({ error: "Sandbox provider reconciliation is temporarily unavailable." }, 503)
  }
}
