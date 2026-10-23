import { NextResponse } from "next/server"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

export const dynamic = "force-dynamic"

const schema = z.object({
  invoiceId: z.string().uuid(),
  paymentMethodId: z.string().uuid(),
  idempotencyKey: z.string().trim().min(8).max(120).regex(/^[A-Za-z0-9._:-]+$/),
  transactionReference: z.string().trim().min(3).max(160).regex(/^[A-Za-z0-9 ._:/+-]+$/),
  amountMinor: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  customerNote: z.string().trim().max(1000).optional(),
}).strict()

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return json({ error: "Provide a valid invoice and payment claim." }, 400)

  try {
    const authClient = createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) return json({ error: "Sign in to submit a payment claim." }, 401)

    const db = createServiceClient() as unknown as SupabaseClient
    const input = parsed.data
    const { data: existing, error: existingError } = await db
      .from("billing_payment_claims")
      .select("id,customer_id,status,invoice_id,idempotency_key")
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle()
    if (existingError) throw existingError
    if (existing) {
      if (existing.customer_id !== user.id || existing.invoice_id !== input.invoiceId) {
        return json({ error: "That request key is already in use." }, 409)
      }
      return json({ claim: { id: existing.id, status: existing.status }, replayed: true })
    }

    const { data: invoice, error: invoiceError } = await db
      .from("billing_invoices")
      .select("id,customer_id,status,currency,total_minor")
      .eq("id", input.invoiceId)
      .maybeSingle()
    if (invoiceError) throw invoiceError
    if (!invoice || invoice.customer_id !== user.id) return json({ error: "Invoice not found." }, 404)
    if (!["unpaid", "partially_paid", "overdue"].includes(invoice.status)) {
      return json({ error: "This invoice is not accepting payment claims." }, 409)
    }

    const { data: method, error: methodError } = await db
      .from("billing_payment_methods")
      .select("id,method_key,display_name,instructions,version,supported_currencies")
      .eq("id", input.paymentMethodId)
      .eq("active", true)
      .maybeSingle()
    if (methodError) throw methodError
    if (!method || !method.supported_currencies?.includes(invoice.currency)) {
      return json({ error: "That payment method is unavailable for this invoice currency." }, 400)
    }

    const { data: activeClaims, error: activeClaimsError } = await db
      .from("billing_payment_claims")
      .select("id")
      .eq("invoice_id", invoice.id)
      .in("status", ["submitted", "needs_info"])
      .limit(1)
    if (activeClaimsError) throw activeClaimsError
    if (activeClaims?.length) {
      return json({ error: "A payment claim for this invoice is already under review. Wait for the review or provide the requested information." }, 409)
    }

    const { data: allocations, error: allocationsError } = await db
      .from("billing_payment_allocations")
      .select("amount_minor,allocation_type")
      .eq("invoice_id", invoice.id)
    if (allocationsError) throw allocationsError
    const allocatedMinor = (allocations ?? []).reduce((sum, row) =>
      sum + (row.allocation_type === "reverse" ? -Number(row.amount_minor) : Number(row.amount_minor)), 0)
    const balanceMinor = Number(invoice.total_minor) - allocatedMinor
    if (!Number.isSafeInteger(balanceMinor) || input.amountMinor > balanceMinor || balanceMinor <= 0) {
      return json({ error: "Claim amount exceeds the current invoice balance." }, 400)
    }

    const { data: claim, error: claimError } = await db
      .from("billing_payment_claims")
      .insert({
        invoice_id: invoice.id,
        customer_id: user.id,
        payment_method_id: method.id,
        method_key_snapshot: method.method_key,
        method_name_snapshot: method.display_name,
        method_instructions_snapshot: method.instructions,
        method_version_snapshot: method.version,
        idempotency_key: input.idempotencyKey,
        transaction_reference: input.transactionReference,
        claimed_amount_minor: input.amountMinor,
        currency: invoice.currency,
        customer_note: input.customerNote?.trim() || null,
        status: "submitted",
      })
      .select("id,status,invoice_id,claimed_amount_minor,currency,created_at")
      .single()
    if (claimError?.code === "23505") return json({ error: "A matching claim was submitted concurrently. Refresh the invoice before trying again." }, 409)
    if (claimError) throw claimError

    const { error: eventError } = await db.from("billing_events").insert({
      invoice_id: invoice.id,
      claim_id: claim.id,
      actor_user_id: user.id,
      event_type: "payment_claim.submitted",
      idempotency_key: `billing-claim-submitted:${claim.id}`,
      details: { amount_minor: input.amountMinor, currency: invoice.currency, method_key: method.method_key },
    })
    if (eventError) throw eventError

    return json({ claim }, 201)
  } catch (error) {
    console.error("[Billing] Failed to submit payment claim:", error)
    return json({ error: "Unable to submit the payment claim right now. Please try again." }, 500)
  }
}
