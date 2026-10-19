import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { deriveRegistrationReconciliationState, getDomainRecoveryAction } from "@/lib/domains/recovery"
import type {
  PaymentReconciliationState,
} from "@/lib/domains/recovery"

export const dynamic = "force-dynamic"

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

    const supabase = createServiceClient() as unknown as SupabaseClient
    const { data: orders, error: ordersError } = await supabase
      .from("domain_orders")
      .select("id,domain_name,status,quote_expires_at,provider_id,provider_order_reference,provider_domain_reference,registered_at,created_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(100)
    if (ordersError) throw ordersError

    const orderIds = (orders ?? []).map((order) => order.id)
    if (!orderIds.length) return NextResponse.json({ items: [], total: 0 })

    const [quoteResult, paymentResult] = await Promise.all([
      supabase
        .from("domain_order_quotes")
        .select("id,order_id,sequence,expires_at,registration_price_minor,renewal_price_minor,currency,created_at")
        .in("order_id", orderIds)
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("domain_payment_attempts")
        .select("id,order_id,provider_id,provider_payment_id,amount_minor,currency,status,last_checked_at,confirmed_at,updated_at")
        .in("order_id", orderIds)
        .order("updated_at", { ascending: false })
        .limit(300),
    ])
    if (quoteResult.error) throw quoteResult.error
    if (paymentResult.error) throw paymentResult.error

    const paymentAttemptIds = (paymentResult.data ?? []).map((payment) => payment.id)
    let webhookEvents: Array<{
      id: string
      payment_attempt_id: string | null
      event_id: string
      event_type: string
      signature_verified: boolean
      processing_status: string
      safe_error_code: string | null
      received_at: string
      processed_at: string | null
    }> = []
    if (paymentAttemptIds.length) {
      const { data, error } = await supabase
        .from("domain_payment_webhook_events")
        .select("id,payment_attempt_id,event_id,event_type,signature_verified,processing_status,safe_error_code,received_at,processed_at")
        .in("payment_attempt_id", paymentAttemptIds)
        .order("received_at", { ascending: false })
        .limit(300)
      if (error) throw error
      webhookEvents = data ?? []
    }

    const orderIdByPaymentAttempt = new Map<string, string>(
      (paymentResult.data ?? []).map((payment) => [payment.id, payment.order_id]),
    )
    const webhookEventsByOrder = new Map<string, typeof webhookEvents>()
    for (const event of webhookEvents) {
      const orderId = event.payment_attempt_id ? orderIdByPaymentAttempt.get(event.payment_attempt_id) : undefined
      if (!orderId) continue
      const eventsForOrder = webhookEventsByOrder.get(orderId) ?? []
      if (eventsForOrder.length < 5) eventsForOrder.push(event)
      webhookEventsByOrder.set(orderId, eventsForOrder)
    }

    const latestQuoteByOrder = new Map<string, (typeof quoteResult.data)[number]>()
    for (const quote of quoteResult.data ?? []) {
      if (!latestQuoteByOrder.has(quote.order_id)) latestQuoteByOrder.set(quote.order_id, quote)
    }
    const latestPaymentByOrder = new Map<string, (typeof paymentResult.data)[number]>()
    for (const payment of paymentResult.data ?? []) {
      if (!latestPaymentByOrder.has(payment.order_id)) latestPaymentByOrder.set(payment.order_id, payment)
    }

    const now = Date.now()
    const items = (orders ?? []).map((order) => {
      const quote = latestQuoteByOrder.get(order.id) ?? null
      const payment = latestPaymentByOrder.get(order.id) ?? null
      const quoteExpiresAt = quote?.expires_at ?? order.quote_expires_at ?? null
      const quoteExpired = (order.status === "quoted" || order.status === "awaiting_payment")
        && (!quoteExpiresAt || Date.parse(quoteExpiresAt) <= now)
      const paymentReconciliation = paymentState(payment?.status)
      const registrationReconciliation = deriveRegistrationReconciliationState({
        orderStatus: order.status,
        providerDomainReference: order.provider_domain_reference,
        registeredAt: order.registered_at,
      })
      const recommendedAction = getDomainRecoveryAction({
        status: order.status,
        quoteExpired,
        payment: paymentReconciliation,
        registration: registrationReconciliation,
      })

      return {
        orderId: order.id,
        domainName: order.domain_name,
        orderStatus: order.status,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        quote: quote ? {
          id: quote.id,
          sequence: quote.sequence,
          expiresAt: quote.expires_at,
          registrationPriceMinor: quote.registration_price_minor,
          renewalPriceMinor: quote.renewal_price_minor,
          currency: quote.currency,
        } : null,
        payment: payment ? {
          id: payment.id,
          provider: payment.provider_id,
          providerPaymentId: payment.provider_payment_id,
          status: payment.status,
          amountMinor: payment.amount_minor,
          currency: payment.currency,
          lastCheckedAt: payment.last_checked_at,
          confirmedAt: payment.confirmed_at,
        } : null,
        registration: {
          provider: order.provider_id,
          providerOrderReference: order.provider_order_reference,
          registeredAt: order.registered_at,
        },
        webhookEvents: (webhookEventsByOrder.get(order.id) ?? []).map((event) => ({
          eventId: event.event_id,
          eventType: event.event_type,
          signatureVerified: event.signature_verified,
          processingStatus: event.processing_status,
          safeErrorCode: event.safe_error_code,
          receivedAt: event.received_at,
          processedAt: event.processed_at,
        })),
        recommendedAction,
      }
    })

    return NextResponse.json({ items, total: items.length, readOnly: true })
  } catch (error) {
    console.error("Admin domain recovery queue failed:", error)
    return NextResponse.json({
      error: "Recovery queue is unavailable. Confirm the domain quote/payment schema migration has been applied to this environment.",
    }, { status: 503 })
  }
}
