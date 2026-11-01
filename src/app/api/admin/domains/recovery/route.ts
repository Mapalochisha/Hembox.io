import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { deriveRegistrationReconciliationState, getDomainRecoveryAction } from "@/lib/domains/recovery"
import type { PaymentReconciliationState } from "@/lib/domains/recovery"
import { deriveDomainLedgerReconciliation } from "@/lib/domains/ledger-reconciliation"

export const dynamic = "force-dynamic"

type InvoiceRow = {
  id: string; invoice_number: string; customer_id: string; status: string
  currency: string; total_minor: number; paid_at: string | null
  source_type: string | null; source_id: string | null
}
type AllocationRow = { invoice_id: string; amount_minor: number; currency: string; allocation_type: string }
type ClaimRow = { invoice_id: string; status: string; claimed_amount_minor: number; currency: string }
type QuoteRow = {
  id: string; order_id: string; sequence: number; expires_at: string
  registration_price_minor: number; renewal_price_minor: number; currency: string; created_at: string
}
type PaymentRow = {
  id: string; order_id: string; provider_id: string; provider_payment_id: string | null
  amount_minor: number; currency: string; status: string
  last_checked_at: string | null; confirmed_at: string | null; updated_at: string
}

async function requireAdmin() {
  const authClient = createClient()
  const { data: { user }, error: userError } = await authClient.auth.getUser()
  if (userError || !user) return { status: 401 as const }
  const { data: role, error: roleError } = await authClient.rpc("get_user_role", { user_id: user.id })
  if (roleError) return { status: 503 as const }
  if (role !== "admin") return { status: 403 as const }
  return { status: 200 as const }
}

function paymentState(status?: string): PaymentReconciliationState {
  if (status === "pending" || status === "confirmed" || status === "failed" || status === "refunded" || status === "unknown" || status === "cancelled") {
    return status === "cancelled" ? "failed" : status
  }
  return "not_started"
}

export async function GET() {
  try {
    const auth = await requireAdmin()
    if (auth.status !== 200) {
      const message = auth.status === 401 ? "Authentication required."
        : auth.status === 403 ? "Administrator access required."
        : "Unable to verify administrator access."
      return NextResponse.json({ error: message }, { status: auth.status })
    }

    const db = createServiceClient() as unknown as SupabaseClient
    const { data: orders, error: ordersError } = await db
      .from("domain_orders")
      .select("id,customer_id,domain_name,status,retail_currency,billing_invoice_id,quote_expires_at,provider_id,provider_order_reference,provider_domain_reference,registered_at,created_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(200)
    if (ordersError) throw ordersError

    const orderRows = orders ?? []
    const orderIds = orderRows.map((order) => order.id)
    if (!orderIds.length) return NextResponse.json({ items: [], total: 0, readOnly: true })

    const linkedInvoiceIds = Array.from(new Set(
      orderRows.map((order) => order.billing_invoice_id).filter((id): id is string => typeof id === "string"),
    ))
    const [quoteResult, paymentResult, domainInvoiceResult, registrantResult, legacyClaimResult] = await Promise.all([
      db.from("domain_order_quotes")
        .select("id,order_id,sequence,expires_at,registration_price_minor,renewal_price_minor,currency,created_at")
        .in("order_id", orderIds).order("created_at", { ascending: false }).limit(500),
      db.from("domain_payment_attempts")
        .select("id,order_id,provider_id,provider_payment_id,amount_minor,currency,status,last_checked_at,confirmed_at,updated_at")
        .in("order_id", orderIds).order("updated_at", { ascending: false }).limit(500),
      db.from("billing_invoices")
        .select("id,invoice_number,customer_id,status,currency,total_minor,paid_at,source_type,source_id")
        .eq("source_type", "domain_registration").in("source_id", orderIds).limit(500),
      db.from("domain_order_registrant_details")
        .select("order_id,customer_id,consent_version,consent_accepted_at").in("order_id", orderIds),
      db.from("domain_manual_payment_claims")
        .select("order_id").in("order_id", orderIds).limit(500),
    ])
    for (const result of [quoteResult, paymentResult, domainInvoiceResult, registrantResult, legacyClaimResult]) {
      if (result.error) throw result.error
    }

    let linkedInvoices: InvoiceRow[] = []
    if (linkedInvoiceIds.length) {
      const { data, error } = await db.from("billing_invoices")
        .select("id,invoice_number,customer_id,status,currency,total_minor,paid_at,source_type,source_id")
        .in("id", linkedInvoiceIds)
      if (error) throw error
      linkedInvoices = (data ?? []) as InvoiceRow[]
    }

    const sourceInvoices = (domainInvoiceResult.data ?? []) as InvoiceRow[]
    const allInvoices = Array.from(new Map([...linkedInvoices, ...sourceInvoices].map((row) => [row.id, row])).values())
    const invoiceIds = allInvoices.map((row) => row.id)
    let allocations: AllocationRow[] = []
    let claims: ClaimRow[] = []
    if (invoiceIds.length) {
      const [allocationResult, claimResult] = await Promise.all([
        db.from("billing_payment_allocations")
          .select("invoice_id,amount_minor,currency,allocation_type").in("invoice_id", invoiceIds).limit(2000),
        db.from("billing_payment_claims")
          .select("invoice_id,status,claimed_amount_minor,currency").in("invoice_id", invoiceIds).limit(1000),
      ])
      if (allocationResult.error) throw allocationResult.error
      if (claimResult.error) throw claimResult.error
      allocations = (allocationResult.data ?? []) as AllocationRow[]
      claims = (claimResult.data ?? []) as ClaimRow[]
    }

    const paymentAttemptIds = (paymentResult.data ?? []).map((row) => row.id)
    let webhookEvents: Array<{
      payment_attempt_id: string | null; event_id: string; event_type: string
      signature_verified: boolean; processing_status: string; safe_error_code: string | null
      received_at: string; processed_at: string | null
    }> = []
    if (paymentAttemptIds.length) {
      const { data, error } = await db.from("domain_payment_webhook_events")
        .select("payment_attempt_id,event_id,event_type,signature_verified,processing_status,safe_error_code,received_at,processed_at")
        .in("payment_attempt_id", paymentAttemptIds).order("received_at", { ascending: false }).limit(500)
      if (error) throw error
      webhookEvents = data ?? []
    }

    const invoiceById = new Map(allInvoices.map((row) => [row.id, row]))
    const invoicesByOrder = new Map<string, InvoiceRow[]>()
    for (const invoice of sourceInvoices) {
      if (!invoice.source_id) continue
      const rows = invoicesByOrder.get(invoice.source_id) ?? []
      rows.push(invoice)
      invoicesByOrder.set(invoice.source_id, rows)
    }
    const allocationsByInvoice = new Map<string, AllocationRow[]>()
    for (const row of allocations) {
      const rows = allocationsByInvoice.get(row.invoice_id) ?? []
      rows.push(row)
      allocationsByInvoice.set(row.invoice_id, rows)
    }
    const claimsByInvoice = new Map<string, ClaimRow[]>()
    for (const row of claims) {
      const rows = claimsByInvoice.get(row.invoice_id) ?? []
      rows.push(row)
      claimsByInvoice.set(row.invoice_id, rows)
    }
    const registrants = new Map<string, string>()
    for (const row of registrantResult.data ?? []) registrants.set(row.order_id, row.customer_id)
    const legacyCounts = new Map<string, number>()
    for (const row of legacyClaimResult.data ?? []) legacyCounts.set(row.order_id, (legacyCounts.get(row.order_id) ?? 0) + 1)

    const paymentOrderMap = new Map<string, string>((paymentResult.data ?? []).map((row) => [row.id, row.order_id]))
    const webhookByOrder = new Map<string, typeof webhookEvents>()
    for (const event of webhookEvents) {
      const orderId = event.payment_attempt_id ? paymentOrderMap.get(event.payment_attempt_id) : undefined
      if (!orderId) continue
      const rows = webhookByOrder.get(orderId) ?? []
      if (rows.length < 5) rows.push(event)
      webhookByOrder.set(orderId, rows)
    }
    const latestQuotes = new Map<string, QuoteRow>()
    for (const quote of (quoteResult.data ?? []) as QuoteRow[]) if (!latestQuotes.has(quote.order_id)) latestQuotes.set(quote.order_id, quote)
    const latestPayments = new Map<string, PaymentRow>()
    for (const payment of (paymentResult.data ?? []) as PaymentRow[]) if (!latestPayments.has(payment.order_id)) latestPayments.set(payment.order_id, payment)

    const now = Date.now()
    const items = orderRows.map((order) => {
      const quote = latestQuotes.get(order.id) ?? null
      const payment = latestPayments.get(order.id) ?? null
      const quoteExpiry = quote?.expires_at ?? order.quote_expires_at ?? null
      const quoteExpired = ["quoted", "awaiting_payment"].includes(order.status)
        && (!quoteExpiry || Date.parse(quoteExpiry) <= now)
      const registrationState = deriveRegistrationReconciliationState({
        orderStatus: order.status,
        providerDomainReference: order.provider_domain_reference,
        registeredAt: order.registered_at,
      })

      const linkedInvoice = order.billing_invoice_id ? invoiceById.get(order.billing_invoice_id) ?? null : null
      const sourceRows = invoicesByOrder.get(order.id) ?? []
      const invoice = linkedInvoice ?? sourceRows[0] ?? null
      const registrantPresent = registrants.get(order.id) === order.customer_id && !!order.customer_id
      const ledger = deriveDomainLedgerReconciliation({
        order: {
          id: order.id, status: order.status, customerId: order.customer_id,
          currency: order.retail_currency, billingInvoiceId: order.billing_invoice_id,
          providerDomainReference: order.provider_domain_reference, registeredAt: order.registered_at,
        },
        invoice: invoice ? {
          id: invoice.id, customerId: invoice.customer_id, sourceType: invoice.source_type,
          sourceId: invoice.source_id, status: invoice.status, currency: invoice.currency,
          totalMinor: Number(invoice.total_minor), paidAt: invoice.paid_at,
        } : null,
        invoiceLinkMatches: !!order.billing_invoice_id && invoice?.id === order.billing_invoice_id,
        duplicateInvoiceCount: sourceRows.length,
        allocations: invoice ? (allocationsByInvoice.get(invoice.id) ?? []).map((row) => ({
          amountMinor: Number(row.amount_minor), currency: row.currency, allocationType: row.allocation_type,
        })) : [],
        paymentClaims: invoice ? (claimsByInvoice.get(invoice.id) ?? []).map((row) => ({
          status: row.status, claimedAmountMinor: Number(row.claimed_amount_minor), currency: row.currency,
        })) : [],
        registrantPresent,
        legacyClaimCount: legacyCounts.get(order.id) ?? 0,
      })

      const baseAction = getDomainRecoveryAction({
        status: order.status,
        quoteExpired,
        payment: paymentState(payment?.status),
        registration: registrationState,
      })
      const recommendedAction = ledger.recommendedAction === "manual_review"
        ? "manual_review"
        : ledger.recommendedAction !== "no_action" ? ledger.recommendedAction : baseAction

      return {
        orderId: order.id, domainName: order.domain_name, orderStatus: order.status,
        createdAt: order.created_at, updatedAt: order.updated_at,
        quote: quote ? {
          id: quote.id, sequence: quote.sequence, expiresAt: quote.expires_at,
          registrationPriceMinor: quote.registration_price_minor,
          renewalPriceMinor: quote.renewal_price_minor, currency: quote.currency,
        } : null,
        payment: payment ? {
          provider: payment.provider_id, status: payment.status, amountMinor: payment.amount_minor,
          currency: payment.currency, lastCheckedAt: payment.last_checked_at, confirmedAt: payment.confirmed_at,
        } : null,
        billing: {
          invoice: invoice ? {
            id: invoice.id, number: invoice.invoice_number, status: invoice.status,
            currency: invoice.currency, totalMinor: Number(invoice.total_minor), paidAt: invoice.paid_at,
          } : null,
          allocatedMinor: ledger.allocatedMinor, outstandingMinor: ledger.outstandingMinor,
          pendingClaimCount: ledger.pendingClaimCount, legacyClaimCount: ledger.legacyClaimCount,
          registrantPresent: ledger.registrantPresent,
        },
        reconciliation: { severity: ledger.severity, issues: ledger.issues },
        registration: {
          provider: order.provider_id, providerOrderReference: order.provider_order_reference,
          registeredAt: order.registered_at,
        },
        webhookEvents: (webhookByOrder.get(order.id) ?? []).map((event) => ({
          eventId: event.event_id, eventType: event.event_type,
          signatureVerified: event.signature_verified, processingStatus: event.processing_status,
          safeErrorCode: event.safe_error_code, receivedAt: event.received_at, processedAt: event.processed_at,
        })),
        recommendedAction,
      }
    })

    return NextResponse.json({ items, total: items.length, readOnly: true })
  } catch (error) {
    console.error("Admin domain recovery queue failed:", error)
    return NextResponse.json({
      error: "Recovery queue is unavailable. Confirm the domain quote, billing and registrant schema migrations have been applied to this environment.",
    }, { status: 503 })
  }
}
