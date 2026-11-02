import { NextResponse } from "next/server"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { createNameSiloSandboxOperations } from "@/lib/domains/providers/namesilo-sandbox-operations"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })
const schema = z.object({
  action: z.enum(["apply", "reject"]),
  requestId: z.string().uuid(),
  adminNote: z.string().trim().max(1000).optional(),
}).strict()

async function adminContext() {
  const auth = createClient()
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

export async function GET() {
  const auth = await adminContext()
  if (auth.status !== 200) return authError(auth.status)
  try {
    const db = createServiceClient() as unknown as SupabaseClient
    const { data, error } = await db.from("domain_management_requests")
      .select("id,order_id,customer_id,request_type,requested_years,requested_nameservers,status,customer_note,admin_note,reviewed_by,reviewed_at,applied_at,provider_result,created_at,domain_orders!inner(id,domain_name,status,expires_at,nameservers,customer_id)")
      .order("created_at", { ascending: false }).limit(100)
    if (error) throw error
    return json({ requests: data ?? [], environment: process.env.DOMAIN_PROVIDER_MODE === "namesilo-sandbox" ? "test" : "restricted" })
  } catch {
    return json({ error: "Domain management queue is unavailable. Apply the management migration first." }, 503)
  }
}

export async function POST(request: Request) {
  const auth = await adminContext()
  if (auth.status !== 200) return authError(auth.status)
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: "Provide a valid management action and request id." }, 400)
  if (parsed.data.action === "apply" && process.env.DOMAIN_PROVIDER_MODE?.trim().toLowerCase() !== "namesilo-sandbox") {
    return json({ error: "Registrar changes are restricted to the NameSilo OTE sandbox. Live operations are not enabled." }, 403)
  }

  const db = createServiceClient() as unknown as SupabaseClient
  try {
    const { data: row, error: readError } = await db.from("domain_management_requests")
      .select("id,order_id,customer_id,request_type,requested_years,requested_nameservers,status,domain_orders!inner(id,domain_name,status,expires_at,nameservers)")
      .eq("id", parsed.data.requestId).maybeSingle()
    if (readError) throw readError
    if (!row || row.status !== "requested") return json({ error: "Open management request not found." }, 404)

    const relatedOrder = Array.isArray(row.domain_orders) ? row.domain_orders[0] : row.domain_orders
    const order = relatedOrder as unknown as { id: string; domain_name: string; status: string; expires_at: string | null; nameservers: string[] | null } | null
    if (!order) return json({ error: "The linked domain order could not be loaded." }, 404)
    if (order.status !== "registered") return json({ error: "The linked domain is no longer in a manageable state." }, 409)

    if (parsed.data.action === "reject") {
      const { data, error } = await db.rpc("record_domain_management_outcome", {
        p_request_id: row.id, p_admin_user_id: auth.user.id, p_status: "rejected",
        p_admin_note: parsed.data.adminNote?.trim() || null,
      })
      if (error) return json({ error: "The request could not be rejected. Check the management migration and administrator role." }, 409)
      return json({ success: true, result: Array.isArray(data) ? data[0] : data })
    }

    const operations = createNameSiloSandboxOperations()
    const before = await operations.getDomainInfo(order.domain_name)
    if (before.state !== "found" || before.providerStatus?.toLowerCase() !== "active") {
      return json({ error: "NameSilo OTE does not confirm this domain as active. No change was attempted." }, 409)
    }

    let providerResult
    let confirmedNameservers: string[] | null = null
    let newExpiresAt: string | null = null

    if (row.request_type === "renewal") {
      providerResult = await operations.renewDomain({
        confirmSandboxOnly: "OTE_ONLY", domain: order.domain_name, years: Number(row.requested_years),
      })
      if (!["acknowledged", "acknowledged_with_warning"].includes(providerResult.state)) {
        return json({ error: providerResult.message, providerState: providerResult.state, reconciliationRequired: providerResult.reconciliationRequired }, providerResult.state === "ambiguous" ? 202 : 409)
      }
      const after = await operations.getDomainInfo(order.domain_name)
      const oldExpiry = order.expires_at ? Date.parse(order.expires_at) : Number.NaN
      const expiry = after.expiresAt ? Date.parse(after.expiresAt) : Number.NaN
      if (after.state !== "found" || !Number.isFinite(expiry) || expiry <= oldExpiry) {
        return json({ error: "NameSilo acknowledged renewal, but the new expiry is not confirmed. Do not retry until provider state is reconciled.", reconciliationRequired: true }, 202)
      }
      newExpiresAt = new Date(expiry).toISOString()
    } else if (row.request_type === "nameservers") {
      const requested = Array.isArray(row.requested_nameservers) ? row.requested_nameservers as string[] : []
      providerResult = await operations.changeNameServers({
        confirmSandboxOnly: "OTE_ONLY", domain: order.domain_name, nameservers: requested,
      })
      if (!["acknowledged", "acknowledged_with_warning"].includes(providerResult.state)) {
        return json({ error: providerResult.message, providerState: providerResult.state, reconciliationRequired: providerResult.reconciliationRequired }, providerResult.state === "ambiguous" ? 202 : 409)
      }
      const after = await operations.getDomainInfo(order.domain_name)
      if (after.state !== "found" || !requested.every((name) => after.nameservers.includes(name))) {
        return json({ error: "NameSilo acknowledged the nameserver change, but the requested values are not confirmed. Do not retry until provider state is reconciled.", reconciliationRequired: true }, 202)
      }
      confirmedNameservers = after.nameservers
    } else {
      return json({ error: "Unsupported management request type." }, 400)
    }

    const { data, error } = await db.rpc("record_domain_management_outcome", {
      p_request_id: row.id,
      p_admin_user_id: auth.user.id,
      p_status: "applied",
      p_admin_note: parsed.data.adminNote?.trim() || null,
      p_confirmed_nameservers: confirmedNameservers,
      p_new_expires_at: newExpiresAt,
      p_provider_result: {
        operation: providerResult.operation,
        state: providerResult.state,
        providerCode: providerResult.providerCode,
        providerOrderAmount: providerResult.providerOrderAmount,
        reconciled: true,
      },
    })
    if (error) return json({ error: "The registrar change was confirmed, but the application record could not be updated. Reconcile before taking further action." }, 503)
    return json({ success: true, provider: "namesilo-ote", result: Array.isArray(data) ? data[0] : data })
  } catch (error) {
    console.error("Admin domain management action failed:", error instanceof Error ? error.name : "unknown")
    return json({ error: "The domain management action could not be completed." }, 503)
  }
}
