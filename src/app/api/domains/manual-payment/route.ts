import { NextResponse } from "next/server"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

export const dynamic = "force-dynamic"

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("begin"), orderId: z.string().uuid() }).strict(),
  z.object({
    action: z.literal("submit"),
    orderId: z.string().uuid(),
    idempotencyKey: z.string().trim().min(8).max(60).regex(/^[A-Za-z0-9._:-]+$/),
    transactionReference: z.string().trim().min(3).max(120).regex(/^[A-Za-z0-9 ._:/+-]+$/),
    customerNote: z.string().trim().max(500).optional(),
  }).strict(),
])

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return json({ error: "Provide a valid order and payment details." }, 400)

  try {
    const authClient = createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) return json({ error: "Sign in to continue." }, 401)

    const instructions = process.env.DOMAIN_MANUAL_PAYMENT_INSTRUCTIONS?.trim()
    const db = createServiceClient() as unknown as SupabaseClient
    const { data: order, error: orderError } = await db
      .from("domain_orders")
      .select("id,customer_id,status,domain_name,retail_currency")
      .eq("id", parsed.data.orderId)
      .eq("customer_id", user.id)
      .maybeSingle()
    if (orderError) throw orderError
    if (!order) return json({ error: "Domain order not found." }, 404)

    const { data: quote, error: quoteError } = await db
      .from("domain_order_quotes")
      .select("total_due_minor,expires_at,sequence")
      .eq("order_id", order.id)
      .order("sequence", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (quoteError) throw quoteError
    if (!quote || new Date(quote.expires_at).getTime() <= Date.now()) {
      return json({ error: "This quote has expired. Request a fresh quote before paying.", code: "quote_expired" }, 409)
    }

    const paymentReference = "HEM-DOM-" + order.id.replaceAll("-", "").slice(0, 12).toUpperCase()

    if (parsed.data.action === "begin") {
      if (!instructions) {
        return json({ error: "Manual payment instructions are not configured yet. Please contact HEMBOX support.", code: "manual_payment_not_configured" }, 503)
      }
      if (order.status === "quoted") {
        const { data: updated, error: updateError } = await db
          .from("domain_orders")
          .update({ status: "awaiting_payment" })
          .eq("id", order.id)
          .eq("customer_id", user.id)
          .eq("status", "quoted")
          .select("id")
          .maybeSingle()
        if (updateError) throw updateError
        if (!updated) return json({ error: "The order changed. Refresh and try again.", code: "order_state_changed" }, 409)
      } else if (order.status !== "awaiting_payment") {
        return json({ error: "This order is not eligible for manual payment.", code: "order_not_payable" }, 409)
      }
      return json({
        order: { id: order.id, domainName: order.domain_name, status: "awaiting_payment" },
        paymentReference,
        amountMinor: quote.total_due_minor,
        currency: "ZMW",
        instructions,
        message: "Use this reference with your transfer. Payment is not confirmed until HEMBOX verifies the funds.",
      })
    }

    if (order.status !== "awaiting_payment") {
      return json({ error: "Request payment instructions before submitting a payment claim.", code: "order_not_awaiting_payment" }, 409)
    }
    const scopedKey = "manual-payment:" + user.id + ":" + parsed.data.idempotencyKey
    const { data: replay, error: replayError } = await db
      .from("domain_manual_payment_claims")
      .select("id,order_id,customer_id,payment_reference,transaction_reference,amount_minor,currency,status,created_at")
      .eq("idempotency_key", scopedKey)
      .maybeSingle()
    if (replayError) throw replayError
    if (replay) {
      if (replay.order_id !== order.id || replay.customer_id !== user.id) {
        return json({ error: "This request key has already been used.", code: "idempotency_key_reused" }, 409)
      }
      return json({ claim: replay, idempotentReplay: true })
    }

    const { data: activeClaim, error: activeClaimError } = await db
      .from("domain_manual_payment_claims")
      .select("id,order_id,customer_id,payment_reference,transaction_reference,amount_minor,currency,status,created_at")
      .eq("order_id", order.id)
      .eq("customer_id", user.id)
      .in("status", ["submitted", "needs_info", "verified"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (activeClaimError) throw activeClaimError
    if (activeClaim?.status === "submitted" || activeClaim?.status === "verified") {
      if (activeClaim.transaction_reference === parsed.data.transactionReference) {
        return json({ claim: activeClaim, idempotentReplay: true })
      }
      return json({ error: "A payment claim is already awaiting review for this order.", code: "claim_already_active" }, 409)
    }

    const { data: correction, error: correctionError } = await db
      .from("domain_manual_payment_claims")
      .select("id,status")
      .eq("order_id", order.id)
      .eq("customer_id", user.id)
      .eq("status", "needs_info")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (correctionError) throw correctionError

    if (correction) {
      const { data: updated, error: updateError } = await db
        .from("domain_manual_payment_claims")
        .update({
          transaction_reference: parsed.data.transactionReference,
          customer_note: parsed.data.customerNote?.trim() || null,
          status: "submitted",
          reviewed_by: null,
          reviewed_at: null,
          review_note: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", correction.id)
        .eq("status", "needs_info")
        .select("id,order_id,customer_id,payment_reference,transaction_reference,amount_minor,currency,status,created_at")
        .maybeSingle()
      if (updateError) throw updateError
      if (!updated) return json({ error: "The claim changed while you were updating it. Refresh and try again." }, 409)
      const { error: auditError } = await db.from("domain_audit_events").insert({
        order_id: order.id,
        actor_user_id: user.id,
        event_type: "domain_manual_payment.claim_resubmitted",
        details: { claim_id: updated.id, payment_reference: paymentReference },
      })
      if (auditError) throw auditError
      return json({ claim: updated })
    }

    const { data: claim, error: insertError } = await db
      .from("domain_manual_payment_claims")
      .insert({
        order_id: order.id,
        customer_id: user.id,
        payment_reference: paymentReference,
        idempotency_key: scopedKey,
        transaction_reference: parsed.data.transactionReference,
        amount_minor: quote.total_due_minor,
        currency: "ZMW",
        customer_note: parsed.data.customerNote?.trim() || null,
      })
      .select("id,order_id,customer_id,payment_reference,transaction_reference,amount_minor,currency,status,created_at")
      .single()
    if (insertError) {
      if (insertError.code === "23505") {
        return json({ error: "A payment claim already exists for this request. Refresh your domain dashboard.", code: "duplicate_claim" }, 409)
      }
      throw insertError
    }
    return json({ claim }, 201)
  } catch (error) {
    console.error("Manual domain payment request failed:", error instanceof Error ? error.name : "unknown")
    return json({ error: "Manual payment is temporarily unavailable. Please try again later." }, 503)
  }
}
