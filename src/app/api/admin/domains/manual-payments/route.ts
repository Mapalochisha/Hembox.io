import { NextResponse } from "next/server"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

export const dynamic = "force-dynamic"

const reviewSchema = z.object({
  claimId: z.string().uuid(),
  decision: z.enum(["verified", "rejected", "needs_info"]),
  reviewNote: z.string().trim().max(500).optional(),
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
    if (auth.status !== 200) {
      return json({ error: auth.status === 401 ? "Authentication required." : auth.status === 403 ? "Administrator access required." : "Unable to verify administrator access." }, auth.status)
    }
    const db = createServiceClient() as unknown as SupabaseClient
    const { data: claims, error } = await db
      .from("domain_manual_payment_claims")
      .select("id,order_id,customer_id,payment_reference,transaction_reference,amount_minor,currency,customer_note,status,review_note,reviewed_by,reviewed_at,created_at,updated_at")
      .order("created_at", { ascending: true })
      .limit(100)
    if (error) throw error
    const orderIds = Array.from(new Set((claims ?? []).map((claim) => claim.order_id)))
    let orders: unknown[] = []
    if (orderIds.length) {
      const { data, error: ordersError } = await db
        .from("domain_orders")
        .select("id,domain_name,status,customer_email,customer_name")
        .in("id", orderIds)
      if (ordersError) throw ordersError
      orders = data ?? []
    }
    return json({ claims: claims ?? [], orders })
  } catch (error) {
    console.error("Manual payment review queue failed:", error instanceof Error ? error.name : "unknown")
    return json({ error: "Manual payment review is temporarily unavailable." }, 503)
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = reviewSchema.safeParse(body)
  if (!parsed.success) return json({ error: "Provide a valid claim and review decision." }, 400)
  try {
    const auth = await requireAdmin()
    if (auth.status !== 200) {
      return json({ error: auth.status === 401 ? "Authentication required." : auth.status === 403 ? "Administrator access required." : "Unable to verify administrator access." }, auth.status)
    }
    const db = createServiceClient() as unknown as SupabaseClient
    const { data, error } = await db.rpc("review_domain_manual_payment_claim", {
      p_claim_id: parsed.data.claimId,
      p_admin_user_id: auth.userId,
      p_decision: parsed.data.decision,
      p_review_note: parsed.data.reviewNote?.trim() || null,
    })
    if (error) {
      if (error.code === "42501") return json({ error: "Administrator access required." }, 403)
      if (error.code === "P0002") return json({ error: "Payment claim or order not found." }, 404)
      if (error.code === "23514" || error.code === "22023") return json({ error: "The claim can no longer be reviewed in this state. Refresh the queue." }, 409)
      throw error
    }
    return json({ result: Array.isArray(data) ? data[0] : data })
  } catch (error) {
    console.error("Manual payment review action failed:", error instanceof Error ? error.name : "unknown")
    return json({ error: "Unable to save the payment review." }, 503)
  }
}
