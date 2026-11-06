import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { createNameSiloSandboxOperations } from "@/lib/domains/providers/namesilo-sandbox-operations"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })
const sandboxEnabled = () => process.env.DOMAIN_PROVIDER_MODE?.trim().toLowerCase() === "namesilo-sandbox"

async function adminContext() {
  const auth = await createClient()
  const { data: { user }, error } = await auth.auth.getUser()
  if (error || !user) return { status: 401 as const }
  const { data: role, error: roleError } = await auth.rpc("get_user_role", { user_id: user.id })
  if (roleError) return { status: 503 as const }
  if (role !== "admin") return { status: 403 as const }
  return { status: 200 as const, user }
}

function authError(status: 401 | 403 | 503) {
  return json({ error: status === 401 ? "Authentication required." : status === 403 ? "Administrator access required." : "Unable to verify administrator access." }, status)
}

type SandboxRegistrant = {
  firstName: string
  lastName: string
  organisationName?: string
  email: string
  phone: string
  addressLine1: string
  addressLine2?: string
  city: string
  region: string
  postalCode: string
  countryCode: string
}

function providerRegistrant(value: unknown): SandboxRegistrant {
  if (!value || typeof value !== "object") throw new Error("Sandbox registrant details are missing.")
  const r = value as Record<string, unknown>
  const required = ["firstName","lastName","email","phone","addressLine1","city","region","postalCode","countryCode"]
  if (required.some((key) => typeof r[key] !== "string" || !(r[key] as string).trim())) {
    throw new Error("Sandbox registrant details are incomplete.")
  }
  if (r.countryCode !== "ZM" || typeof r.phone !== "string" || !/^\+260[0-9]{9}$/.test(r.phone)) {
    throw new Error("Sandbox registration currently supports valid Zambian registrant contact details only.")
  }
  return {
    firstName: r.firstName as string,
    lastName: r.lastName as string,
    organisationName: typeof r.organisationName === "string" ? r.organisationName : undefined,
    email: r.email as string,
    phone: r.phone,
    addressLine1: r.addressLine1 as string,
    addressLine2: typeof r.addressLine2 === "string" ? r.addressLine2 : undefined,
    city: r.city as string,
    region: r.region as string,
    postalCode: r.postalCode as string,
    countryCode: "ZM",
  }
}

export async function GET() {
  if (!sandboxEnabled()) return json({ error: "Sandbox operations are disabled." }, 404)
  const auth = await adminContext()
  if (auth.status !== 200) return authError(auth.status)
  try {
    const db = createServiceClient() as unknown as SupabaseClient
    const { data, error } = await db.from("domain_sandbox_orders")
      .select("id,customer_id,domain_name,term_years,status,payment_mode,payment_status,test_payment_reference,test_payment_submitted_at,test_payment_reviewed_at,test_payment_admin_note,provider_environment,provider_code,provider_order_amount,registered_at,expires_at,nameservers,last_provider_check_at,last_provider_message,created_at")
      .order("created_at", { ascending: false }).limit(100)
    if (error) throw error
    return json({ orders: data ?? [], environment: "test", live: false })
  } catch {
    return json({ error: "Sandbox orders are unavailable. Apply the sandbox migration before testing." }, 503)
  }
}

export async function POST(request: Request) {
  if (!sandboxEnabled()) return json({ error: "Sandbox operations are disabled." }, 404)
  const auth = await adminContext()
  if (auth.status !== 200) return authError(auth.status)

  const body = await request.json().catch(() => null) as { orderId?: unknown; action?: unknown; adminNote?: unknown } | null
  const actions = ["approve_payment","reject_payment","reconcile","reset_if_unregistered"]
  if (!body || typeof body.orderId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.orderId) ||
      !actions.includes(String(body.action)) || (body.adminNote !== undefined && (typeof body.adminNote !== "string" || body.adminNote.length > 1000))) {
    return json({ error: "Provide an order id, a supported sandbox action and an optional admin note." }, 400)
  }

  const action = body.action as typeof actions[number]
  const adminNote = typeof body.adminNote === "string" ? body.adminNote.trim() : ""
  const db = createServiceClient() as unknown as SupabaseClient

  try {
    const { data: order, error } = await db.from("domain_sandbox_orders")
      .select("*").eq("id", body.orderId).maybeSingle()
    if (error) throw error
    if (!order) return json({ error: "Sandbox order not found." }, 404)

    if (action === "reject_payment") {
      if (order.status !== "payment_pending" || order.payment_status !== "submitted") {
        return json({ error: "Only submitted sandbox payment references can be rejected." }, 409)
      }
      const reviewedAt = new Date().toISOString()
      const { data: updated, error: updateError } = await db.from("domain_sandbox_orders").update({
        status: "quoted",
        payment_status: "simulated_rejected",
        test_payment_reviewed_at: reviewedAt,
        test_payment_reviewed_by: auth.user.id,
        test_payment_admin_note: adminNote || "Sandbox payment reference rejected by administrator.",
        last_provider_message: "The sandbox test reference was rejected. No funds were collected; the customer may submit a corrected test reference.",
      }).eq("id", order.id).eq("status", "payment_pending").eq("payment_status", "submitted")
        .select("id,status,payment_status,test_payment_reference,test_payment_reviewed_at").maybeSingle()
      if (updateError) throw updateError
      if (!updated) return json({ error: "The payment reference was already reviewed. Refresh the queue." }, 409)
      const { error: eventError } = await db.from("domain_sandbox_events").insert({
        order_id: order.id, actor_user_id: auth.user.id, event_type: "payment_simulated_rejected",
        details: { test_reference: order.test_payment_reference, amount_minor: 0, real_payment: false, admin_note: adminNote || null },
      })
      if (eventError) {
        await db.from("domain_sandbox_orders").update({
          status: "payment_pending", payment_status: "submitted",
          test_payment_reviewed_at: null, test_payment_reviewed_by: null,
          test_payment_admin_note: null,
          last_provider_message: "The rejection audit could not be saved. The test payment remains awaiting review.",
        }).eq("id", order.id).eq("status", "quoted").eq("payment_status", "simulated_rejected")
        throw eventError
      }
      return json({ success: true, order: updated, message: "Sandbox payment reference rejected. The customer can submit another test reference." })
    }

    if (action === "approve_payment") {
      if (order.status !== "payment_pending" || order.payment_status !== "submitted") {
        return json({ error: "Only submitted sandbox payment references can be approved." }, 409)
      }
      const reviewedAt = new Date().toISOString()
      const { data: locked, error: lockError } = await db.from("domain_sandbox_orders").update({
        status: "registration_pending",
        payment_status: "simulated_approved",
        test_payment_reviewed_at: reviewedAt,
        test_payment_reviewed_by: auth.user.id,
        test_payment_admin_note: adminNote || "Zero-value sandbox payment reference approved.",
        last_provider_check_at: reviewedAt,
        last_provider_message: "Administrator approved a zero-value sandbox payment reference. No funds were collected; NameSilo OTE registration is starting.",
      }).eq("id", order.id).eq("status", "payment_pending").eq("payment_status", "submitted")
        .select("id").maybeSingle()
      if (lockError) throw lockError
      if (!locked) return json({ error: "The payment reference was already reviewed. Refresh the queue." }, 409)

      const { error: eventError } = await db.from("domain_sandbox_events").insert([
        { order_id: order.id, actor_user_id: auth.user.id, event_type: "payment_simulated_approved", details: { test_reference: order.test_payment_reference, amount_minor: 0, real_payment: false, admin_note: adminNote || null } },
        { order_id: order.id, actor_user_id: auth.user.id, event_type: "registration_started", details: { provider: "namesilo", environment: "test", domain: order.domain_name, term_years: order.term_years } },
      ])
      if (eventError) {
        await db.from("domain_sandbox_orders").update({
          status: "payment_pending", payment_status: "submitted",
          test_payment_reviewed_at: null, test_payment_reviewed_by: null,
          test_payment_admin_note: null,
          last_provider_message: "The payment approval audit could not be saved. No registrar operation was attempted.",
        }).eq("id", order.id).eq("status", "registration_pending")
        throw eventError
      }

      const outcome = await createNameSiloSandboxOperations().registerDomain({
        confirmSandboxOnly: "OTE_ONLY",
        domain: order.domain_name,
        years: order.term_years,
        privateWhois: true,
        autoRenew: false,
        registrant: providerRegistrant(order.registrant_details),
      })

      if (outcome.state === "rejected" || outcome.state === "not_attempted") {
        await db.from("domain_sandbox_orders").update({
          status: "registration_failed", provider_code: outcome.providerCode,
          provider_order_amount: outcome.providerOrderAmount,
          last_provider_check_at: new Date().toISOString(), last_provider_message: outcome.message,
        }).eq("id", order.id)
        await db.from("domain_sandbox_events").insert({ order_id: order.id, actor_user_id: auth.user.id, event_type: "registration_failed", details: { state: outcome.state, provider_code: outcome.providerCode, message: outcome.message } })
        return json({ success: false, orderStatus: "registration_failed", error: outcome.message }, 409)
      }

      if (outcome.state === "ambiguous") {
        await db.from("domain_sandbox_orders").update({
          status: "registration_unknown", provider_code: outcome.providerCode,
          provider_order_amount: outcome.providerOrderAmount,
          last_provider_check_at: new Date().toISOString(), last_provider_message: outcome.message,
        }).eq("id", order.id)
        await db.from("domain_sandbox_events").insert({ order_id: order.id, actor_user_id: auth.user.id, event_type: "registration_ambiguous", details: { provider_code: outcome.providerCode, message: outcome.message } })
        return json({ success: false, orderStatus: "registration_unknown", error: outcome.message }, 202)
      }

      await db.from("domain_sandbox_events").insert({ order_id: order.id, actor_user_id: auth.user.id, event_type: "registration_acknowledged", details: { provider_code: outcome.providerCode, provider_order_amount: outcome.providerOrderAmount } })
      const info = await createNameSiloSandboxOperations().getDomainInfo(order.domain_name)
      const expiry = info.expiresAt ? Date.parse(info.expiresAt) : Number.NaN
      const active = info.state === "found" && info.providerStatus?.toLowerCase() === "active" && Number.isFinite(expiry) && expiry > Date.now()
      if (!active) {
        await db.from("domain_sandbox_orders").update({
          status: "registration_unknown", provider_code: outcome.providerCode,
          provider_order_amount: outcome.providerOrderAmount,
          last_provider_check_at: new Date().toISOString(), last_provider_message: info.message,
        }).eq("id", order.id)
        return json({ success: false, orderStatus: "registration_unknown", error: "NameSilo acknowledged registration, but active ownership and expiry are not yet confirmed. Reconcile OTE state before any retry." }, 202)
      }

      const expiresAt = new Date(expiry).toISOString()
      const registeredAt = info.createdAt && Number.isFinite(Date.parse(info.createdAt)) ? new Date(info.createdAt).toISOString() : reviewedAt
      const { data: saved, error: saveError } = await db.from("domain_sandbox_orders").update({
        status: "registered", provider_code: outcome.providerCode,
        provider_order_amount: outcome.providerOrderAmount,
        registered_at: registeredAt, expires_at: expiresAt, nameservers: info.nameservers,
        last_provider_check_at: new Date().toISOString(),
        last_provider_message: "NameSilo OTE confirmed the domain is active in the sandbox account.",
      }).eq("id", order.id).select("id,domain_name,term_years,status,payment_mode,payment_status,test_payment_reference,test_payment_submitted_at,registered_at,expires_at,nameservers").single()
      if (saveError) throw saveError
      await db.from("domain_sandbox_events").insert({ order_id: order.id, actor_user_id: auth.user.id, event_type: "registration_reconciled", details: { provider_code: outcome.providerCode, expires_at: expiresAt, nameservers: info.nameservers } })
      return json({ success: true, registered: true, order: saved, provider: "namesilo-ote" })
    }

    const operations = createNameSiloSandboxOperations()
    const info = await operations.getDomainInfo(order.domain_name)
    if (action === "reset_if_unregistered") {
      if (!["registration_pending", "registration_unknown", "registration_failed"].includes(order.status)) return json({ error: "Only pending, ambiguous or failed registrations can be reset." }, 409)
      const availability = await operations.checkAvailability([order.domain_name])
      if (info.state !== "unknown" || info.providerCode !== 200 || availability[0]?.availability !== "available") {
        return json({ error: "OTE has not independently confirmed that registration did not occur. The order remains held; do not retry." }, 409)
      }
      const { error: resetError } = await db.from("domain_sandbox_orders").update({
        status: "quoted", payment_status: "not_started",
        test_payment_reference: null, test_payment_submitted_at: null,
        test_payment_reviewed_at: null, test_payment_reviewed_by: null, test_payment_admin_note: null,
        provider_code: null, provider_order_amount: null,
        last_provider_check_at: new Date().toISOString(),
        last_provider_message: "Administrator confirmed the domain is not active in OTE and currently available; a new sandbox payment reference may be submitted.",
      }).eq("id", order.id).eq("status", order.status)
      if (resetError) throw resetError
      const { error: eventError } = await db.from("domain_sandbox_events").insert({ order_id: order.id, actor_user_id: auth.user.id, event_type: "registration_retry_authorized", details: { provider_code: info.providerCode, availability: availability[0]?.availability, admin_confirmed: true } })
      if (eventError) {
        await db.from("domain_sandbox_orders").update({
          status: order.status, payment_status: order.payment_status,
          test_payment_reference: order.test_payment_reference,
          test_payment_submitted_at: order.test_payment_submitted_at,
          test_payment_reviewed_at: order.test_payment_reviewed_at,
          test_payment_reviewed_by: order.test_payment_reviewed_by,
          test_payment_admin_note: order.test_payment_admin_note,
          provider_code: order.provider_code,
          provider_order_amount: order.provider_order_amount,
          last_provider_message: order.last_provider_message,
        }).eq("id", order.id).eq("status", "quoted").eq("payment_status", "not_started")
        throw eventError
      }
      return json({ reset: true, orderId: order.id, message: "OTE confirms no active registration and fresh availability. The customer may submit a new sandbox payment reference." })
    }

    if (action !== "reconcile") return json({ error: "Unsupported sandbox action." }, 400)
    if (!["registration_pending", "registration_unknown"].includes(order.status)) return json({ error: "Only pending or ambiguous registrations can be reconciled." }, 409)
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
  } catch (error) {
    console.error("Admin sandbox action failed:", error instanceof Error ? error.name : "unknown")
    return json({ error: "The sandbox action could not be completed. Inspect the order and OTE state before retrying." }, 503)
  }
}
