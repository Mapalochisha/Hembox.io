import { NextResponse } from "next/server"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

export const dynamic = "force-dynamic"

const reviewSchema = z.object({
  claimId: z.string().uuid(),
  decision: z.enum(["verified", "rejected", "needs_info"]),
  reviewNote: z.string().trim().max(1000).optional(),
}).strict()

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })
}

async function requireAdmin() {
  const authClient = createClient()
  const { data: { user }, error: userError } = await authClient.auth.getUser()
  if (userError || !user) return { status: 401 as const }
  const { data: role, error: roleError } = await authClient.rpc("get_user_role", { user_id: user.id })
  if (roleError) return { status: 503 as const }
  if (role !== "admin") return { status: 403 as const }
  return { status: 200 as const, userId: user.id }
}

export async function GET() {
  try {
    const auth = await requireAdmin()
    if (auth.status !== 200) return json({ error: auth.status === 401 ? "Authentication required." : auth.status === 403 ? "Administrator access required." : "Unable to verify administrator access." }, auth.status)
    const db = createServiceClient() as unknown as SupabaseClient
    const { data: claims, error } = await db.from("billing_payment_claims")
      .select("id,invoice_id,customer_id,method_key_snapshot,method_name_snapshot,transaction_reference,claimed_amount_minor,currency,customer_note,receipt_object_key,receipt_mime_type,receipt_size_bytes,status,review_note,reviewed_by,reviewed_at,created_at")
      .order("created_at", { ascending: true }).limit(200)
    if (error) throw error
    const invoiceIds = Array.from(new Set((claims ?? []).map((claim) => claim.invoice_id)))
    const invoiceMap = new Map<string, unknown>()
    if (invoiceIds.length) {
      const { data: invoices, error: invoiceError } = await db.from("billing_invoices")
        .select("id,invoice_number,status,currency,total_minor,due_at,customer_id")
        .in("id", invoiceIds)
      if (invoiceError) throw invoiceError
      for (const invoice of invoices ?? []) invoiceMap.set(invoice.id, invoice)
    }
    return json({ claims: (claims ?? []).map((claim) => ({ ...claim, invoice: invoiceMap.get(claim.invoice_id) ?? null })) })
  } catch (error) {
    console.error("[Billing admin] Failed to load payment claims:", error)
    return json({ error: "Unable to load billing claims right now." }, 500)
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = reviewSchema.safeParse(body)
  if (!parsed.success) return json({ error: "Provide a valid claim review decision." }, 400)
  try {
    const auth = await requireAdmin()
    if (auth.status !== 200) return json({ error: auth.status === 401 ? "Authentication required." : auth.status === 403 ? "Administrator access required." : "Unable to verify administrator access." }, auth.status)
    const db = createServiceClient() as unknown as SupabaseClient
    const { data, error } = await db.rpc("review_billing_payment_claim", {
      p_claim_id: parsed.data.claimId,
      p_admin_id: auth.userId,
      p_decision: parsed.data.decision,
      p_review_note: parsed.data.reviewNote?.trim() || null,
    })
    if (error) {
      if (error.code === "42501") return json({ error: "Administrator access is required to review a payment." }, 403)
      if (error.code === "P0002") return json({ error: "Payment claim not found." }, 404)
      if (error.code === "23514" || error.code === "22023") return json({ error: error.message }, 409)
      throw error
    }
    return json({ result: Array.isArray(data) ? data[0] : data })
  } catch (error) {
    console.error("[Billing admin] Failed to review payment claim:", error)
    return json({ error: "Unable to complete this review. Refresh the queue and try again." }, 500)
  }
}
