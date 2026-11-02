import { NextResponse } from "next/server"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { canManageDomainOrder, isManagementRequestType, normalizeNameservers, normalizeRenewalYears } from "@/lib/domains/management"

export const dynamic = "force-dynamic"
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })

const schema = z.object({
  orderId: z.string().uuid(),
  requestType: z.enum(["renewal", "nameservers"]),
  requestedYears: z.unknown().optional(),
  requestedNameservers: z.unknown().optional(),
  customerNote: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().trim().min(8).max(120).regex(/^[A-Za-z0-9._:-]+$/),
}).strict()

async function currentUser() {
  const auth = createClient()
  const { data: { user }, error } = await auth.auth.getUser()
  return error || !user ? null : user
}

export async function GET(request: Request) {
  const user = await currentUser()
  if (!user) return json({ error: "Sign in to view domain management requests." }, 401)
  const orderId = new URL(request.url).searchParams.get("orderId")
  if (!orderId || !z.string().uuid().safeParse(orderId).success) return json({ error: "Provide a valid order id." }, 400)
  try {
    const db = createServiceClient() as unknown as SupabaseClient
    const { data: order, error: orderError } = await db.from("domain_orders")
      .select("id,customer_id,status,domain_name,expires_at,nameservers,nameservers_updated_at")
      .eq("id", orderId).eq("customer_id", user.id).maybeSingle()
    if (orderError) throw orderError
    if (!order) return json({ error: "Domain order not found." }, 404)
    const { data: requests, error } = await db.from("domain_management_requests")
      .select("id,order_id,request_type,requested_years,requested_nameservers,status,customer_note,admin_note,reviewed_at,applied_at,created_at")
      .eq("order_id", orderId).eq("customer_id", user.id).order("created_at", { ascending: false }).limit(20)
    if (error) throw error
    return json({ order, requests: requests ?? [] })
  } catch {
    return json({ error: "Domain management is unavailable. The management migration may not be deployed." }, 503)
  }
}

export async function POST(request: Request) {
  const user = await currentUser()
  if (!user) return json({ error: "Sign in to request a domain change." }, 401)
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: "Provide a valid domain management request." }, 400)
  const input = parsed.data
  if (!isManagementRequestType(input.requestType)) return json({ error: "Unsupported management request." }, 400)

  let requestedYears: number | null = null
  let requestedNameservers: string[] | null = null
  if (input.requestType === "renewal") {
    const result = normalizeRenewalYears(input.requestedYears)
    if (!result.ok) return json({ error: result.message }, 400)
    requestedYears = result.years
    if (input.requestedNameservers !== undefined) return json({ error: "A renewal request cannot include nameservers." }, 400)
  } else {
    const result = normalizeNameservers(input.requestedNameservers)
    if (!result.ok) return json({ error: result.message }, 400)
    requestedNameservers = result.nameservers
    if (input.requestedYears !== undefined) return json({ error: "A nameserver request cannot include renewal years." }, 400)
  }

  try {
    const db = createServiceClient() as unknown as SupabaseClient
    const { data: order, error: orderError } = await db.from("domain_orders")
      .select("id,customer_id,status").eq("id", input.orderId).eq("customer_id", user.id).maybeSingle()
    if (orderError) throw orderError
    if (!order || !canManageDomainOrder(order.status)) return json({ error: "Only registered domains in your account can be managed." }, 409)

    const { data, error } = await db.rpc("create_domain_management_request", {
      p_order_id: input.orderId,
      p_customer_id: user.id,
      p_request_type: input.requestType,
      p_requested_years: requestedYears,
      p_requested_nameservers: requestedNameservers,
      p_customer_note: input.customerNote?.trim() || null,
      p_idempotency_key: input.idempotencyKey,
    })
    if (error) {
      if (error.code === "23505") return json({ error: "An open request already exists or this request key has been used." }, 409)
      if (error.code === "42501") return json({ error: "This domain order does not belong to your account." }, 403)
      if (error.code === "23514" || error.code === "22023") return json({ error: "The management request is not valid for this domain." }, 400)
      throw error
    }
    return json({ request: Array.isArray(data) ? data[0] : data }, 201)
  } catch {
    return json({ error: "The management request could not be saved." }, 503)
  }
}
