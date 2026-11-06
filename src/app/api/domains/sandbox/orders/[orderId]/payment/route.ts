import { NextResponse } from "next/server"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
const schema = z.object({
  testReference: z.string().trim().min(8).max(100).regex(/^[A-Za-z0-9._:-]+$/),
}).strict()
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })

export async function POST(request: Request, context: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await context.params
  if (process.env.DOMAIN_PROVIDER_MODE?.trim().toLowerCase() !== "namesilo-sandbox") return json({ error: "Sandbox checkout is disabled." }, 404)
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: "Enter a test payment reference between 8 and 100 characters using letters, numbers, dots, dashes or underscores." }, 400)

  const auth = await createClient()
  const { data: { user }, error: authError } = await auth.auth.getUser()
  if (authError || !user) return json({ error: "Sign in to submit the sandbox payment step." }, 401)

  const db = createServiceClient() as unknown as SupabaseClient
  try {
    const { data: order, error } = await db.from("domain_sandbox_orders")
      .select("id,status,payment_status,test_payment_reference,test_payment_submitted_at")
      .eq("id", orderId).eq("customer_id", user.id).maybeSingle()
    if (error) throw error
    if (!order) return json({ error: "Sandbox order not found." }, 404)
    if (order.status !== "quoted" || !["not_started", "simulated_rejected"].includes(order.payment_status)) {
      return json({ error: "This order is not ready for a new sandbox payment submission.", status: order.status, paymentStatus: order.payment_status }, 409)
    }

    const submittedAt = new Date().toISOString()
    const { data: locked, error: updateError } = await db.from("domain_sandbox_orders").update({
      status: "payment_pending",
      payment_status: "submitted",
      test_payment_reference: parsed.data.testReference,
      test_payment_submitted_at: submittedAt,
      test_payment_reviewed_at: null,
      test_payment_reviewed_by: null,
      test_payment_admin_note: null,
      last_provider_message: "Zero-value sandbox payment reference submitted. Awaiting administrator review; no funds were collected.",
    }).eq("id", order.id).eq("customer_id", user.id).eq("status", "quoted").eq("payment_status", order.payment_status)
      .select("id,status,payment_status,test_payment_reference,test_payment_submitted_at").maybeSingle()
    if (updateError) throw updateError
    if (!locked) return json({ error: "The order changed while the payment reference was being submitted. Refresh and try again." }, 409)

    const { error: eventError } = await db.from("domain_sandbox_events").insert({
      order_id: order.id,
      actor_user_id: user.id,
      event_type: "payment_claim_submitted",
      details: { payment_mode: "sandbox_simulated", test_reference: parsed.data.testReference, amount_minor: 0, real_payment: false },
    })
    if (eventError) {
      await db.from("domain_sandbox_orders").update({
        status: "quoted",
        payment_status: order.payment_status,
        test_payment_reference: order.test_payment_reference,
        test_payment_submitted_at: order.test_payment_submitted_at,
        last_provider_message: "Payment audit event could not be saved. No payment was collected; please retry.",
      }).eq("id", order.id).eq("status", "payment_pending")
      throw eventError
    }
    return json({ order: locked, message: "Test payment reference submitted for administrator review. No money was transferred." }, 201)
  } catch {
    return json({ error: "The sandbox payment reference could not be submitted." }, 503)
  }
}
