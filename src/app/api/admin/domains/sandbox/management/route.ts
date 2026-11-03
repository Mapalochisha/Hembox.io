import { NextResponse } from "next/server"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { createNameSiloSandboxOperations } from "@/lib/domains/providers/namesilo-sandbox-operations"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })
const schema = z.object({ action: z.enum(["apply","reject","reconcile"]), requestId: z.string().uuid(), adminNote: z.string().trim().max(1000).optional() }).strict()

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
  if (process.env.DOMAIN_PROVIDER_MODE?.trim().toLowerCase() !== "namesilo-sandbox") return json({ error: "Sandbox operations are disabled." }, 404)
  const auth = await adminContext()
  if (auth.status !== 200) return authError(auth.status)
  const db = createServiceClient() as unknown as SupabaseClient
  const { data, error } = await db.from("domain_sandbox_management_requests")
    .select("id,order_id,customer_id,request_type,requested_years,requested_nameservers,previous_expires_at,previous_nameservers,customer_note,status,admin_note,reviewed_at,applied_at,provider_result,created_at,domain_sandbox_orders!inner(domain_name,status,expires_at,nameservers)")
    .order("created_at", { ascending: false }).limit(100)
  if (error) return json({ error: "Sandbox management queue unavailable. Apply the sandbox management migration." }, 503)
  return json({ requests: data ?? [], environment: "test", live: false })
}

export async function POST(request: Request) {
  if (process.env.DOMAIN_PROVIDER_MODE?.trim().toLowerCase() !== "namesilo-sandbox") return json({ error: "Sandbox operations are disabled." }, 404)
  const auth = await adminContext()
  if (auth.status !== 200) return authError(auth.status)
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: "Provide a valid management action and request id." }, 400)
  const db = createServiceClient() as unknown as SupabaseClient
  try {
    const { data: row, error } = await db.from("domain_sandbox_management_requests")
      .select("*,domain_sandbox_orders!inner(id,domain_name,status,expires_at,nameservers)")
      .eq("id", parsed.data.requestId).maybeSingle()
    if (error) throw error
    if (!row) return json({ error: "Management request not found." }, 404)
    const order = Array.isArray(row.domain_sandbox_orders) ? row.domain_sandbox_orders[0] : row.domain_sandbox_orders
    if (!order || order.status !== "registered") return json({ error: "The linked sandbox domain is not in a manageable registered state." }, 409)

    if (parsed.data.action === "reject") {
      const { data, error: updateError } = await db.from("domain_sandbox_management_requests").update({
        status: "rejected", admin_note: parsed.data.adminNote?.trim() || "Request rejected by HEMBOX administrator.",
        reviewed_by: auth.user.id, reviewed_at: new Date().toISOString(),
      }).eq("id", row.id).eq("status", "requested").select("id,status").maybeSingle()
      if (updateError) throw updateError
      if (!data) return json({ error: "Only a pending request can be rejected." }, 409)
      return json({ success: true, request: data })
    }

    if (parsed.data.action === "apply") {
      const { data: locked, error: lockError } = await db.from("domain_sandbox_management_requests").update({
        status: "processing", reviewed_by: auth.user.id, reviewed_at: new Date().toISOString(),
        admin_note: parsed.data.adminNote?.trim() || null,
      }).eq("id", row.id).eq("status", "requested").select("id").maybeSingle()
      if (lockError) throw lockError
      if (!locked) return json({ error: "This request is no longer pending. Unknown or processing requests must be reconciled, never re-applied." }, 409)
    } else if (row.status !== "unknown") {
      return json({ error: "Only an unknown registrar outcome can be reconciled." }, 409)
    }

    const operations = createNameSiloSandboxOperations()
    const info = await operations.getDomainInfo(order.domain_name)
    if (info.state !== "found" || info.providerStatus?.toLowerCase() !== "active") {
      if (parsed.data.action === "apply") {
        await db.from("domain_sandbox_management_requests").update({ status: "failed", provider_result: { state: "not_attempted", message: info.message } }).eq("id", row.id).eq("status", "processing")
      }
      return json({ error: "OTE does not confirm an active domain. No registrar mutation was attempted.", providerInfo: info }, 409)
    }

    let providerResult: { state: string; operation: string; providerCode: number | null; providerOrderAmount?: string | null } | null = null
    let confirmedNameservers: string[] | null = null
    let newExpiresAt: string | null = null
    if (parsed.data.action === "apply") {
      try {
        if (row.request_type === "renewal") {
          providerResult = await operations.renewDomain({ confirmSandboxOnly: "OTE_ONLY", domain: order.domain_name, years: Number(row.requested_years) })
        } else {
          providerResult = await operations.changeNameServers({ confirmSandboxOnly: "OTE_ONLY", domain: order.domain_name, nameservers: row.requested_nameservers as string[] })
        }
      } catch (e) {
        await db.from("domain_sandbox_management_requests").update({ status: "unknown", provider_result: { state: "unknown", error: e instanceof Error ? e.name : "provider_error" } }).eq("id", row.id).eq("status", "processing")
        return json({ error: "The registrar outcome is uncertain. Reconcile OTE state before any further action.", reconciliationRequired: true }, 202)
      }
      if (!["acknowledged","acknowledged_with_warning"].includes(providerResult.state)) {
        const uncertain = providerResult.state === "ambiguous"
        await db.from("domain_sandbox_management_requests").update({
          status: uncertain ? "unknown" : "failed",
          provider_result: { operation: providerResult.operation, state: providerResult.state, providerCode: providerResult.providerCode },
        }).eq("id", row.id).eq("status", "processing")
        return json({ error: providerResult.state === "ambiguous" ? "OTE returned an ambiguous outcome. Reconcile before any further action." : "OTE did not apply the requested change.", providerState: providerResult.state, reconciliationRequired: uncertain }, uncertain ? 202 : 409)
      }
    } else {
      providerResult = row.provider_result?.operation
        ? { operation: row.provider_result.operation, state: "reconciled", providerCode: row.provider_result.providerCode ?? null }
        : { operation: row.request_type === "renewal" ? "renewDomain" : "changeNameServers", state: "reconciled", providerCode: null }
    }

    const after = await operations.getDomainInfo(order.domain_name)
    if (after.state !== "found" || after.providerStatus?.toLowerCase() !== "active") {
      await db.from("domain_sandbox_management_requests").update({ status: "unknown", provider_result: { operation: providerResult.operation, state: "unknown", providerCode: providerResult.providerCode } }).eq("id", row.id)
      return json({ error: "The registrar response is not yet confirmed. Request is held for read-only reconciliation; do not retry.", reconciliationRequired: true }, 202)
    }
    if (row.request_type === "renewal") {
      const expiry = after.expiresAt ? Date.parse(after.expiresAt) : Number.NaN
      const oldExpiry = row.previous_expires_at ? Date.parse(row.previous_expires_at) : Number.NaN
      if (!Number.isFinite(expiry) || !Number.isFinite(oldExpiry) || expiry <= oldExpiry) {
        await db.from("domain_sandbox_management_requests").update({ status: "unknown", provider_result: { operation: providerResult.operation, state: "unconfirmed", providerCode: providerResult.providerCode } }).eq("id", row.id)
        return json({ error: "A later expiry has not been confirmed. Request is held for read-only reconciliation; do not retry.", reconciliationRequired: true }, 202)
      }
      newExpiresAt = new Date(expiry).toISOString()
    } else {
      const requested = row.requested_nameservers as string[]
      if (!requested.every((server) => after.nameservers.includes(server))) {
        await db.from("domain_sandbox_management_requests").update({ status: "unknown", provider_result: { operation: providerResult.operation, state: "unconfirmed", providerCode: providerResult.providerCode } }).eq("id", row.id)
        return json({ error: "The requested nameservers are not confirmed. Request is held for read-only reconciliation; do not retry.", reconciliationRequired: true }, 202)
      }
      confirmedNameservers = after.nameservers
    }

    const now = new Date().toISOString()
    const { error: orderUpdateError } = await db.from("domain_sandbox_orders").update({
      ...(newExpiresAt ? { expires_at: newExpiresAt } : {}),
      ...(confirmedNameservers ? { nameservers: confirmedNameservers } : {}),
      last_provider_check_at: now,
      last_provider_message: "NameSilo OTE confirmed the administrator-approved domain management change.",
      ...(providerResult.providerCode !== null ? { provider_code: providerResult.providerCode } : {}),
      ...(providerResult.providerOrderAmount ? { provider_order_amount: providerResult.providerOrderAmount } : {}),
    }).eq("id", order.id)
    if (orderUpdateError) {
      await db.from("domain_sandbox_management_requests").update({ status: "unknown", provider_result: { operation: providerResult.operation, state: "confirmed_record_update_failed" } }).eq("id", row.id)
      return json({ error: "OTE confirmed the change but the HEMBOX order record update failed. Reconcile before further action.", reconciliationRequired: true }, 503)
    }
    const { error: requestUpdateError } = await db.from("domain_sandbox_management_requests").update({
      status: "applied", applied_at: now, reviewed_by: auth.user.id,
      reviewed_at: row.reviewed_at ?? now,
      provider_result: { operation: providerResult.operation, state: providerResult.state, providerCode: providerResult.providerCode, reconciled: true, expiresAt: newExpiresAt, nameservers: confirmedNameservers },
    }).eq("id", row.id).in("status", ["processing","unknown"])
    if (requestUpdateError) throw requestUpdateError
    return json({ success: true, requestId: row.id, expiresAt: newExpiresAt, nameservers: confirmedNameservers, provider: "namesilo-ote", live: false })
  } catch {
    return json({ error: "The sandbox management action could not be completed. Inspect OTE state before any retry." }, 503)
  }
}
