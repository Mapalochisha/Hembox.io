import { NextResponse } from "next/server"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
const createSchema = z.object({
  invoiceId: z.string().uuid(),
  requestedTerms: z.string().trim().min(5).max(3000),
  requestedAmountMinor: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  requestedMethodKey: z.string().trim().max(40).optional(),
}).strict()
const acceptSchema = z.object({ arrangementId: z.string().uuid() }).strict()
function json(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }) }

export async function GET() {
  try {
    const authClient = createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) return json({ error: "Sign in to view payment arrangements." }, 401)
    const db = createClient() as unknown as SupabaseClient
    const { data, error } = await db.from("billing_arrangement_requests")
      .select("id,invoice_id,conversation_id,requested_method_key,requested_terms,requested_currency,requested_amount_minor,status,decision_note,agreed_terms,decided_at,customer_confirmed_at,created_at")
      .eq("customer_id", user.id).order("created_at", { ascending: false }).limit(100)
    if (error) throw error
    return json({ arrangements: data ?? [] })
  } catch (error) {
    console.error("[Billing] Failed to load arrangements:", error)
    return json({ error: "Unable to load payment arrangements right now." }, 500)
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return json({ error: "Provide an invoice and valid arrangement terms." }, 400)
  try {
    const authClient = createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user || !user.email) return json({ error: "Sign in with an email address to request an arrangement." }, 401)
    const db = createClient() as unknown as SupabaseClient
    const { data: invoice, error: invoiceError } = await db.from("billing_invoices")
      .select("id,invoice_number,customer_id,currency,total_minor,status").eq("id", parsed.data.invoiceId).maybeSingle()
    if (invoiceError) throw invoiceError
    if (!invoice || invoice.customer_id !== user.id) return json({ error: "Invoice not found." }, 404)
    if (!["unpaid", "partially_paid", "overdue"].includes(invoice.status)) return json({ error: "This invoice cannot accept an arrangement request." }, 409)
    const { data: existingArrangement, error: existingArrangementError } = await db.from("billing_arrangement_requests")
      .select("id,status").eq("invoice_id",invoice.id).eq("customer_id",user.id).in("status",["pending","approved"]).limit(1).maybeSingle()
    if (existingArrangementError) throw existingArrangementError
    if (existingArrangement) return json({ error: "An arrangement request is already active for this invoice.", arrangement: existingArrangement }, 409)

    const { data: inquiry, error: inquiryError } = await db.from("inquiries").insert({
      type: "contact", email: user.email, customer_id: user.id, name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
      message: `Billing arrangement request for invoice ${invoice.invoice_number}\n\n${parsed.data.requestedTerms.trim()}`,
      source: "billing", status: "new",
    }).select("id").single()
    if (inquiryError) throw inquiryError
    const { error: messageError } = await db.from("inquiry_messages").insert({
      inquiry_id: inquiry.id, sender_role: "customer", sender_id: user.id,
      body: `Payment arrangement request for invoice ${invoice.invoice_number} (${invoice.currency}).\n\nRequested terms: ${parsed.data.requestedTerms.trim()}${parsed.data.requestedAmountMinor ? `\nRequested payment amount: ${parsed.data.requestedAmountMinor} minor units` : ""}${parsed.data.requestedMethodKey ? `\nPreferred method: ${parsed.data.requestedMethodKey}` : ""}`,
    })
    if (messageError) throw messageError
    const { data: result, error } = await db.rpc("authenticated_request_billing_arrangement", {
      p_invoice_id: invoice.id, p_conversation_id: inquiry.id,
      p_requested_terms: parsed.data.requestedTerms.trim(),
      p_requested_amount_minor: parsed.data.requestedAmountMinor ?? null,
      p_requested_method_key: parsed.data.requestedMethodKey ?? null,
    })
    if (error) {
      if (error.code === "P0002") return json({ error: "Invoice not found." }, 404)
      if (error.code === "42501") return json({ error: "This billing conversation could not be linked to your account." }, 403)
      if (error.code === "23514" || error.code === "22023") return json({ error: error.message }, 409)
      throw error
    }
    const row = Array.isArray(result) ? result[0] : result
    if (row && typeof row === "object" && "created" in row && row.created === false) {
      const { error: cleanupError } = await db.from("inquiries").delete().eq("id",inquiry.id)
      if (cleanupError) console.error("[Billing] Could not clean up duplicate arrangement conversation:",cleanupError)
      return json({ result: row, replayed: true })
    }
    return json({ result: row, conversationId: inquiry.id }, 201)
  } catch (error) {
    console.error("[Billing] Failed to request arrangement:", error)
    return json({ error: "Unable to request a payment arrangement right now. Please try again." }, 500)
  }
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = acceptSchema.safeParse(body)
  if (!parsed.success) return json({ error: "Provide a valid arrangement request." }, 400)
  try {
    const authClient = createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) return json({ error: "Sign in to accept an arrangement." }, 401)
    const db = createClient() as unknown as SupabaseClient
    const { data, error } = await db.rpc("authenticated_accept_billing_arrangement", { p_arrangement_id: parsed.data.arrangementId })
    if (error) {
      if (error.code === "P0002") return json({ error: "Arrangement request not found." }, 404)
      if (error.code === "23514") return json({ error: error.message }, 409)
      throw error
    }
    return json({ result: Array.isArray(data) ? data[0] : data })
  } catch (error) {
    console.error("[Billing] Failed to accept arrangement:", error)
    return json({ error: "Unable to accept this arrangement right now." }, 500)
  }
}
