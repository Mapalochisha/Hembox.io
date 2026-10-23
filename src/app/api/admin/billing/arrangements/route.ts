import { NextResponse } from "next/server"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

export const dynamic = "force-dynamic"
const schema = z.object({
  arrangementId: z.string().uuid(),
  decision: z.enum(["approved", "declined"]),
  decisionNote: z.string().trim().max(1000).optional(),
  agreedTerms: z.string().trim().min(5).max(3000).optional(),
}).strict()
function json(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }) }
async function requireAdmin() {
  const client = createClient()
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) return { status: 401 as const }
  const { data: role, error: roleError } = await client.rpc("get_user_role", { user_id: user.id })
  if (roleError) return { status: 503 as const }
  if (role !== "admin") return { status: 403 as const }
  return { status: 200 as const, userId: user.id }
}
export async function GET() {
  try {
    const auth = await requireAdmin()
    if (auth.status !== 200) return json({ error: auth.status === 401 ? "Authentication required." : auth.status === 403 ? "Administrator access required." : "Unable to verify administrator access." }, auth.status)
    const db = createServiceClient() as unknown as SupabaseClient
    const { data, error } = await db.from("billing_arrangement_requests")
      .select("id,invoice_id,customer_id,conversation_id,requested_method_key,requested_terms,requested_currency,requested_amount_minor,status,decision_note,agreed_terms,decided_by,decided_at,customer_confirmed_at,created_at")
      .order("created_at", { ascending: false }).limit(200)
    if (error) throw error
    const invoiceIds = [...new Set((data ?? []).map((item) => item.invoice_id))]
    const customerIds = [...new Set((data ?? []).map((item) => item.customer_id))]
    const [{ data: invoices, error: invoiceError }, { data: profiles, error: profileError }] = await Promise.all([
      invoiceIds.length ? db.from("billing_invoices").select("id,invoice_number,currency,total_minor,status").in("id", invoiceIds) : Promise.resolve({ data: [], error: null }),
      customerIds.length ? db.from("profiles").select("id,email,full_name").in("id", customerIds) : Promise.resolve({ data: [], error: null }),
    ])
    if (invoiceError) throw invoiceError
    if (profileError) throw profileError
    const invoiceMap = new Map((invoices ?? []).map((item) => [item.id, item]))
    const profileMap = new Map((profiles ?? []).map((item) => [item.id, item]))
    return json({ arrangements: (data ?? []).map((item) => ({ ...item, invoice: invoiceMap.get(item.invoice_id) ?? null, customer: profileMap.get(item.customer_id) ?? null })) })
  } catch (error) {
    console.error("[Billing admin] Failed to load arrangements:", error)
    return json({ error: "Unable to load payment arrangements right now." }, 500)
  }
}
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return json({ error: "Provide a valid arrangement decision and agreed terms when approving." }, 400)
  if (parsed.data.decision === "approved" && !parsed.data.agreedTerms?.trim()) return json({ error: "Approved arrangements require the exact terms the customer must confirm." }, 400)
  try {
    const auth = await requireAdmin()
    if (auth.status !== 200) return json({ error: auth.status === 401 ? "Authentication required." : auth.status === 403 ? "Administrator access required." : "Unable to verify administrator access." }, auth.status)
    const db = createServiceClient() as unknown as SupabaseClient
    const { data, error } = await db.rpc("review_billing_arrangement", {
      p_arrangement_id: parsed.data.arrangementId, p_admin_id: auth.userId,
      p_decision: parsed.data.decision, p_decision_note: parsed.data.decisionNote?.trim() || null,
      p_agreed_terms: parsed.data.decision === "approved" ? parsed.data.agreedTerms?.trim() : null,
    })
    if (error) {
      if (error.code === "42501") return json({ error: "Administrator access is required." }, 403)
      if (error.code === "P0002") return json({ error: "Arrangement request not found." }, 404)
      if (error.code === "23514" || error.code === "22023") return json({ error: error.message }, 409)
      throw error
    }
    return json({ result: Array.isArray(data) ? data[0] : data })
  } catch (error) {
    console.error("[Billing admin] Failed to review arrangement:", error)
    return json({ error: "Unable to review this arrangement right now." }, 500)
  }
}
