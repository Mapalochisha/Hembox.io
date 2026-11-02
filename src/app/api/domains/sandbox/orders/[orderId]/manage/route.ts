import { NextResponse } from "next/server"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { createNameSiloSandboxOperations } from "@/lib/domains/providers/namesilo-sandbox-operations"
import { normalizeNameSiloSandboxNameservers } from "@/lib/domains/providers/namesilo-sandbox-contract"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("renew"), years: z.number().int().min(1).max(10) }).strict(),
  z.object({ action: z.literal("nameservers"), nameservers: z.array(z.string()).min(2).max(8) }).strict(),
])

export async function GET(_request: Request, context: { params: { orderId: string } }) {
  if (process.env.DOMAIN_PROVIDER_MODE?.trim().toLowerCase() !== "namesilo-sandbox") return json({ error: "Sandbox management is disabled." }, 404)
  const auth = createClient()
  const { data: { user }, error } = await auth.auth.getUser()
  if (error || !user) return json({ error: "Sign in to manage this domain." }, 401)
  const db = createServiceClient() as unknown as SupabaseClient
  try {
    const { data: order, error: orderError } = await db.from("domain_sandbox_orders")
      .select("id,customer_id,domain_name,status,expires_at,nameservers,provider_environment")
      .eq("id", context.params.orderId).eq("customer_id", user.id).maybeSingle()
    if (orderError) throw orderError
    if (!order) return json({ error: "Domain not found in your sandbox account." }, 404)
    if (order.status !== "registered") return json({ error: "Only a confirmed registered domain can be managed." }, 409)
    const info = await createNameSiloSandboxOperations().getDomainInfo(order.domain_name)
    await db.from("domain_sandbox_orders").update({
      last_provider_check_at: new Date().toISOString(),
      last_provider_message: info.message,
      ...(info.state === "found" && info.expiresAt && Number.isFinite(Date.parse(info.expiresAt))
        ? { expires_at: new Date(info.expiresAt).toISOString(), nameservers: info.nameservers }
        : {}),
    }).eq("id", order.id).eq("customer_id", user.id)
    await db.from("domain_sandbox_events").insert({
      order_id: order.id, actor_user_id: user.id, event_type: "domain_info_checked",
      details: { provider_code: info.providerCode, state: info.state, status: info.providerStatus, expires_at: info.expiresAt, nameservers: info.nameservers },
    })
    return json({ order, providerInfo: info, environment: "test", live: false })
  } catch {
    return json({ error: "NameSilo OTE domain information is temporarily unavailable." }, 503)
  }
}

export async function POST(request: Request, context: { params: { orderId: string } }) {
  if (process.env.DOMAIN_PROVIDER_MODE?.trim().toLowerCase() !== "namesilo-sandbox") return json({ error: "Sandbox management is disabled." }, 404)
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: "Provide a valid renewal term or nameserver list." }, 400)
  const auth = createClient()
  const { data: { user }, error } = await auth.auth.getUser()
  if (error || !user) return json({ error: "Sign in to manage this domain." }, 401)
  const db = createServiceClient() as unknown as SupabaseClient
  try {
    const { data: order, error: orderError } = await db.from("domain_sandbox_orders")
      .select("id,customer_id,domain_name,status,expires_at,nameservers")
      .eq("id", context.params.orderId).eq("customer_id", user.id).maybeSingle()
    if (orderError) throw orderError
    if (!order || order.status !== "registered") return json({ error: "Only your confirmed registered sandbox domains can be managed." }, 404)

    const operations = createNameSiloSandboxOperations()
    const before = await operations.getDomainInfo(order.domain_name)
    if (before.state !== "found" || before.providerStatus?.toLowerCase() !== "active") {
      return json({ error: "NameSilo OTE did not confirm this domain is active. No management change was attempted." }, 409)
    }

    if (parsed.data.action === "renew") {
      const result = await operations.renewDomain({ confirmSandboxOnly: "OTE_ONLY", domain: order.domain_name, years: parsed.data.years })
      if (!["acknowledged", "acknowledged_with_warning"].includes(result.state)) {
        return json({ error: result.message, providerState: result.state }, result.state === "ambiguous" ? 202 : 409)
      }
      const after = await operations.getDomainInfo(order.domain_name)
      const oldExpiry = order.expires_at ? Date.parse(order.expires_at) : Number.NaN
      const newExpiry = after.expiresAt ? Date.parse(after.expiresAt) : Number.NaN
      if (after.state !== "found" || !Number.isFinite(newExpiry) || newExpiry <= oldExpiry) {
        return json({ error: "The registrar acknowledged renewal, but a later expiry is not confirmed. Refresh provider state before any retry.", code: "renewal_reconciliation_required" }, 202)
      }
      const expiresAt = new Date(newExpiry).toISOString()
      const { error: updateError } = await db.from("domain_sandbox_orders").update({
        expires_at: expiresAt, provider_code: result.providerCode,
        provider_order_amount: result.providerOrderAmount, last_provider_check_at: new Date().toISOString(),
        last_provider_message: "NameSilo OTE confirmed the renewed expiry date.",
      }).eq("id", order.id).eq("customer_id", user.id)
      if (updateError) throw updateError
      await db.from("domain_sandbox_events").insert({ order_id: order.id, actor_user_id: user.id, event_type: "renewal_applied", details: { years: parsed.data.years, provider_code: result.providerCode, provider_order_amount: result.providerOrderAmount, expires_at: expiresAt } })
      return json({ success: true, expiresAt, provider: "namesilo-ote", live: false })
    }

    const nameservers = normalizeNameSiloSandboxNameservers(parsed.data.nameservers)
    const result = await operations.changeNameServers({ confirmSandboxOnly: "OTE_ONLY", domain: order.domain_name, nameservers })
    if (!["acknowledged", "acknowledged_with_warning"].includes(result.state)) {
      return json({ error: result.message, providerState: result.state }, result.state === "ambiguous" ? 202 : 409)
    }
    const after = await operations.getDomainInfo(order.domain_name)
    const confirmed = after.state === "found" && nameservers.every((server) => after.nameservers.includes(server))
    if (!confirmed) return json({ error: "NameSilo acknowledged the nameserver update, but the new values are not yet confirmed. Refresh provider state before retrying.", code: "nameserver_reconciliation_required" }, 202)
    const { error: updateError } = await db.from("domain_sandbox_orders").update({
      nameservers: after.nameservers, provider_code: result.providerCode,
      last_provider_check_at: new Date().toISOString(),
      last_provider_message: "NameSilo OTE confirmed the requested nameservers.",
    }).eq("id", order.id).eq("customer_id", user.id)
    if (updateError) throw updateError
    await db.from("domain_sandbox_events").insert({ order_id: order.id, actor_user_id: user.id, event_type: "nameservers_changed", details: { nameservers: after.nameservers, provider_code: result.providerCode } })
    return json({ success: true, nameservers: after.nameservers, provider: "namesilo-ote", live: false })
  } catch (error) {
    const message = error instanceof Error && /nameserver|hostname|supported/i.test(error.message) ? error.message : "The sandbox domain change could not be confirmed."
    return json({ error: message }, 503)
  }
}
