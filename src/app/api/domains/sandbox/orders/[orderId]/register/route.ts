import { NextResponse } from "next/server"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { createNameSiloSandboxOperations } from "@/lib/domains/providers/namesilo-sandbox-operations"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const schema = z.object({ confirmSandboxPayment: z.literal(true) }).strict()
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })

export async function POST(request: Request, context: { params: { orderId: string } }) {
  if (process.env.DOMAIN_PROVIDER_MODE?.trim().toLowerCase() !== "namesilo-sandbox") return json({ error: "Sandbox registration is disabled." }, 404)
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: "Confirm the no-charge sandbox payment step to continue." }, 400)

  const auth = createClient()
  const { data: { user }, error: authError } = await auth.auth.getUser()
  if (authError || !user) return json({ error: "Sign in to continue." }, 401)

  const db = createServiceClient() as unknown as SupabaseClient
  try {
    const { data: order, error } = await db.from("domain_sandbox_orders")
      .select("*").eq("id", context.params.orderId).eq("customer_id", user.id).maybeSingle()
    if (error) throw error
    if (!order) return json({ error: "Sandbox order not found." }, 404)
    if (order.status === "registered") return json({ order: { ...order, registrant_details: undefined }, replay: true })
    if (order.status !== "quoted") {
      return json({ error: "This order is already being registered or needs provider reconciliation. Do not retry the registrar operation.", code: "registration_reconciliation_required", status: order.status }, 409)
    }

    const operations = createNameSiloSandboxOperations()
    const availability = await operations.checkAvailability([order.domain_name])
    if (availability[0]?.availability !== "available") {
      return json({ error: availability[0]?.message ?? "OTE did not confirm availability. No registration was attempted.", code: "availability_unconfirmed" }, 409)
    }

    const startedAt = new Date().toISOString()
    const { error: lockError } = await db.from("domain_sandbox_orders").update({
      status: "registration_pending",
      payment_status: "simulated",
      last_provider_check_at: startedAt,
      last_provider_message: "Sandbox payment acknowledged. No real funds were collected.",
    }).eq("id", order.id).eq("status", "quoted")
    if (lockError) throw lockError

    await db.from("domain_sandbox_events").insert([
      { order_id: order.id, actor_user_id: user.id, event_type: "payment_simulated", details: { payment_mode: "sandbox_simulated", amount_minor: 0, real_payment: false } },
      { order_id: order.id, actor_user_id: user.id, event_type: "registration_started", details: { provider: "namesilo", environment: "test", domain: order.domain_name, term_years: order.term_years } },
    ])

    const registrant = order.registrant_details
    const outcome = await operations.registerDomain({
      confirmSandboxOnly: "OTE_ONLY",
      domain: order.domain_name,
      years: order.term_years,
      privateWhois: true,
      autoRenew: false,
      registrant: {
        firstName: registrant.firstName,
        lastName: registrant.lastName,
        organisationName: registrant.organisationName ?? undefined,
        email: registrant.email,
        phone: registrant.phone,
        addressLine1: registrant.addressLine1,
        addressLine2: registrant.addressLine2 ?? undefined,
        city: registrant.city,
        region: registrant.region,
        postalCode: registrant.postalCode,
        countryCode: registrant.countryCode,
      },
    })

    if (outcome.state === "rejected" || outcome.state === "not_attempted") {
      await db.from("domain_sandbox_orders").update({
        status: "registration_failed", provider_code: outcome.providerCode,
        provider_order_amount: outcome.providerOrderAmount,
        last_provider_check_at: new Date().toISOString(), last_provider_message: outcome.message,
      }).eq("id", order.id)
      await db.from("domain_sandbox_events").insert({ order_id: order.id, actor_user_id: user.id, event_type: "registration_failed", details: { state: outcome.state, provider_code: outcome.providerCode, message: outcome.message } })
      return json({ error: outcome.message, orderStatus: "registration_failed", provider: "namesilo-ote" }, 409)
    }

    if (outcome.state === "ambiguous") {
      await db.from("domain_sandbox_orders").update({
        status: "registration_unknown", provider_code: outcome.providerCode,
        provider_order_amount: outcome.providerOrderAmount,
        last_provider_check_at: new Date().toISOString(), last_provider_message: outcome.message,
      }).eq("id", order.id)
      await db.from("domain_sandbox_events").insert({ order_id: order.id, actor_user_id: user.id, event_type: "registration_ambiguous", details: { provider_code: outcome.providerCode, message: outcome.message } })
      return json({ error: outcome.message, code: "registration_ambiguous", orderStatus: "registration_unknown" }, 202)
    }

    await db.from("domain_sandbox_events").insert({ order_id: order.id, actor_user_id: user.id, event_type: "registration_acknowledged", details: { provider_code: outcome.providerCode, provider_order_amount: outcome.providerOrderAmount } })

    // An API acknowledgement is not proof of ownership. Read the OTE account
    // again and only mark the order registered when the provider confirms it.
    const info = await operations.getDomainInfo(order.domain_name)
    const expiry = info.expiresAt ? Date.parse(info.expiresAt) : Number.NaN
    const isActive = info.state === "found" && info.providerStatus?.toLowerCase() === "active" && Number.isFinite(expiry) && expiry > Date.now()
    if (!isActive) {
      await db.from("domain_sandbox_orders").update({
        status: "registration_unknown", provider_code: outcome.providerCode,
        provider_order_amount: outcome.providerOrderAmount,
        last_provider_check_at: new Date().toISOString(), last_provider_message: info.message,
      }).eq("id", order.id)
      return json({ error: "NameSilo acknowledged registration, but ownership and expiry are not yet confirmed. The order is held for reconciliation; do not retry.", code: "registration_reconciliation_required" }, 202)
    }

    const expiresAt = new Date(expiry).toISOString()
    const registeredAt = info.createdAt && Number.isFinite(Date.parse(info.createdAt)) ? new Date(info.createdAt).toISOString() : startedAt
    const { data: saved, error: saveError } = await db.from("domain_sandbox_orders").update({
      status: "registered", provider_code: outcome.providerCode,
      provider_order_amount: outcome.providerOrderAmount, registered_at: registeredAt,
      expires_at: expiresAt, nameservers: info.nameservers,
      last_provider_check_at: new Date().toISOString(), last_provider_message: "NameSilo OTE confirmed the domain is active in the sandbox account.",
    }).eq("id", order.id).select("id,domain_name,term_years,status,payment_mode,payment_status,provider_environment,registered_at,expires_at,nameservers").single()
    if (saveError) throw saveError
    await db.from("domain_sandbox_events").insert({ order_id: order.id, actor_user_id: user.id, event_type: "registration_reconciled", details: { provider_code: outcome.providerCode, expires_at: expiresAt, nameservers: info.nameservers } })
    return json({ order: saved, provider: "namesilo-ote", registered: true }, 200)
  } catch (error) {
    console.error("Sandbox registration flow failed:", error instanceof Error ? error.name : "unknown")
    return json({ error: "The sandbox registration could not be confirmed. The order may require reconciliation; do not submit another registration request." }, 503)
  }
}
