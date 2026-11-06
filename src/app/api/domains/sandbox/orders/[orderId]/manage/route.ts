import { NextResponse } from "next/server"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { createNameSiloSandboxOperations } from "@/lib/domains/providers/namesilo-sandbox-operations"
import { normalizeNameSiloSandboxNameservers } from "@/lib/domains/providers/namesilo-sandbox-contract"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("renew"), years: z.number().int().min(1).max(10), idempotencyKey: z.string().min(8).max(120), customerNote: z.string().trim().max(500).optional() }).strict(),
  z.object({ action: z.literal("nameservers"), nameservers: z.array(z.string()).min(2).max(8), idempotencyKey: z.string().min(8).max(120), customerNote: z.string().trim().max(500).optional() }).strict(),
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
    if (!order || order.status !== "registered") return json({ error: "Only your confirmed registered sandbox domains can be managed." }, 404)
    const [info, requestsResult] = await Promise.all([
      createNameSiloSandboxOperations().getDomainInfo(order.domain_name),
      db.from("domain_sandbox_management_requests")
        .select("id,request_type,requested_years,requested_nameservers,customer_note,status,admin_note,reviewed_at,applied_at,created_at")
        .eq("order_id", order.id).eq("customer_id", user.id).order("created_at", { ascending: false }).limit(50),
    ])
    if (requestsResult.error) throw requestsResult.error
    if (info.state === "found") {
      await db.from("domain_sandbox_orders").update({
        last_provider_check_at: new Date().toISOString(), last_provider_message: info.message,
        ...(info.expiresAt && Number.isFinite(Date.parse(info.expiresAt)) ? { expires_at: new Date(info.expiresAt).toISOString(), nameservers: info.nameservers } : {}),
      }).eq("id", order.id).eq("customer_id", user.id)
    }
    return json({ order, providerInfo: info, requests: requestsResult.data ?? [], environment: "test", live: false })
  } catch {
    return json({ error: "Sandbox domain information or management requests are temporarily unavailable." }, 503)
  }
}

export async function POST(request: Request, context: { params: { orderId: string } }) {
  if (process.env.DOMAIN_PROVIDER_MODE?.trim().toLowerCase() !== "namesilo-sandbox") return json({ error: "Sandbox management is disabled." }, 404)
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: "Provide a valid renewal term or nameserver list and request key." }, 400)
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
    const existing = await db.from("domain_sandbox_management_requests").select("*")
      .eq("customer_id", user.id).eq("idempotency_key", parsed.data.idempotencyKey).maybeSingle()
    if (existing.error) throw existing.error
    if (existing.data) return json({ request: existing.data, message: "This request was already submitted." }, 200)
    const requestType = parsed.data.action === "renew" ? "renewal" : "nameservers"
    const requestedNameservers = parsed.data.action === "nameservers" ? normalizeNameSiloSandboxNameservers(parsed.data.nameservers) : null
    const duplicateQuery = db.from("domain_sandbox_management_requests").select("id,request_type,requested_years,requested_nameservers,status,created_at")
      .eq("order_id", order.id).eq("customer_id", user.id).in("status", ["requested","processing","unknown"]).eq("request_type", requestType)
    const { data: duplicate, error: duplicateError } = parsed.data.action === "renew"
      ? await duplicateQuery.eq("requested_years", parsed.data.years).maybeSingle()
      : await duplicateQuery.contains("requested_nameservers", requestedNameservers ?? []).maybeSingle()
    if (duplicateError) throw duplicateError
    if (duplicate) return json({ request: duplicate, message: "An identical request is already awaiting review or reconciliation." }, 200)
    const payload = parsed.data.action === "renew"
      ? { request_type: "renewal", requested_years: parsed.data.years, requested_nameservers: null }
      : { request_type: "nameservers", requested_years: null, requested_nameservers: requestedNameservers }
    const { data: created, error: insertError } = await db.from("domain_sandbox_management_requests").insert({
      order_id: order.id, customer_id: user.id, ...payload,
      previous_expires_at: order.expires_at, previous_nameservers: order.nameservers ?? [],
      customer_note: parsed.data.customerNote?.trim() || null, idempotency_key: parsed.data.idempotencyKey,
    }).select("id,request_type,requested_years,requested_nameservers,status,created_at").single()
    if (insertError) throw insertError
    return json({ request: created, message: "Your request has been sent to HEMBOX for administrator review. NameSilo OTE has not been changed." }, 201)
  } catch {
    return json({ error: "The sandbox management request could not be saved." }, 503)
  }
}
