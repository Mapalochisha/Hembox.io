"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import type { FormEvent } from "react"
import { CheckCircle2, Globe2, Loader2, RefreshCw, Search } from "lucide-react"
import { PortalShell } from "@/components/portal/portal-shell"
import { useAuth } from "@/components/providers/auth-provider"

type DomainOrder = {
  id: string
  domain_name: string
  status: string
  retail_currency: string
  registration_retail_minor: number | null
  renewal_retail_minor: number | null
  quote_expires_at: string | null
  registered_at: string | null
  expires_at: string | null
  created_at: string
}

type ManualPaymentClaim = {
  id: string
  order_id: string
  payment_reference: string
  transaction_reference: string
  amount_minor: number
  currency: string
  status: string
  review_note: string | null
  created_at: string
  updated_at: string
}
type PaymentSession = { paymentReference: string; amountMinor: number; currency: string; instructions: string }
type RegistrantDetails = {
  order_id: string
  registrant_type: "individual" | "organisation"
  first_name: string
  last_name: string
  organisation_name: string | null
  email: string
  phone: string
  address_line1: string
  address_line2: string | null
  city: string
  region: string
  postal_code: string | null
  country_code: string
  consent_version: string
  consent_accepted_at: string
  updated_at: string
}
type DomainQuoteResponse = {
  order: { id: string; status: string }
  quote: {
    id: string
    domainName: string
    currency: string
    registrationPriceMinor: number
    renewalPriceMinor: number
    termYears: number
    totalDueMinor: number
    createdAt: string
    expiresAt: string
    usable: boolean
  }
  availability: {
    provider: string | null
    checkedAt: string | null
    status: string
  }
  checkoutEnabled: boolean
  registrationEnabled: boolean
  message: string
  idempotentReplay?: boolean
}

function dateTime(value: string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? "Not recorded" : parsed.toLocaleString()
}

function money(minor: number | null, currency: string) {
  if (minor === null) return "Awaiting confirmed quote"
  return new Intl.NumberFormat("en-ZM", { style: "currency", currency: currency || "ZMW", maximumFractionDigits: 2 }).format(minor / 100)
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export default function CustomerDomainsPage() {
  const { user, isLoading: authLoading } = useAuth()
  const [orders, setOrders] = useState<DomainOrder[]>([])
  const [paymentClaims, setPaymentClaims] = useState<ManualPaymentClaim[]>([])
  const [registrantDetails, setRegistrantDetails] = useState<RegistrantDetails[]>([])
  const [registrantAvailable, setRegistrantAvailable] = useState(true)
  const [registrantEditing, setRegistrantEditing] = useState<Record<string, boolean>>({})
  const [registrantBusyOrder, setRegistrantBusyOrder] = useState("")
  const [registrantError, setRegistrantError] = useState("")
  const [registrantNotice, setRegistrantNotice] = useState("")
  const [paymentSessions, setPaymentSessions] = useState<Record<string, PaymentSession>>({})
  const [paymentBusyOrder, setPaymentBusyOrder] = useState("")
  const [paymentError, setPaymentError] = useState("")
  const [paymentNotice, setPaymentNotice] = useState("")
  const paymentRequestKeys = useRef<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [quoteDomain, setQuoteDomain] = useState("")
  const [quoteResult, setQuoteResult] = useState<DomainQuoteResponse | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState("")
  const quoteRequestKey = useRef<{ domain: string; key: string } | null>(null)

  const loadOrders = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/domains/orders", { cache: "no-store" })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to load your domain orders.")
      setOrders(result.orders ?? [])
      setPaymentClaims(result.paymentClaims ?? [])
      setRegistrantDetails(result.registrantDetails ?? [])
      setRegistrantAvailable(result.registrantDetailsAvailable !== false)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load your domain orders.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading && user) void loadOrders()
    if (!authLoading && !user) setLoading(false)
  }, [authLoading, user, loadOrders])

  async function beginManualPayment(orderId: string) {
    setPaymentBusyOrder(orderId); setPaymentError(""); setPaymentNotice("")
    try {
      const response = await fetch("/api/domains/manual-payment", {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
        body: JSON.stringify({ action: "begin", orderId }),
      })
      const result = await response.json()
      if (!response.ok) {
        if (result.code === "unified_billing_in_use") {
          window.location.assign("/portal/bills")
          return
        }
        throw new Error(result.error || "Manual payment instructions are unavailable.")
      }
      setPaymentSessions((previous) => ({ ...previous, [orderId]: {
        paymentReference: result.paymentReference, amountMinor: result.amountMinor,
        currency: result.currency, instructions: result.instructions,
      } }))
      setPaymentNotice("Use the exact order reference in your transfer. Your payment is not confirmed until HEMBOX TECH verifies settled funds.")
      void loadOrders()
    } catch (e) {
      setPaymentError(e instanceof Error ? e.message : "Manual payment instructions are unavailable.")
    } finally { setPaymentBusyOrder("") }
  }

  async function submitManualPaymentClaim(event: FormEvent<HTMLFormElement>, orderId: string) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const transactionReference = String(data.get("transactionReference") || "").trim()
    const customerNote = String(data.get("customerNote") || "").trim()
    if (!transactionReference) { setPaymentError("Enter the transaction reference shown by your payment provider."); return }
    setPaymentBusyOrder(orderId); setPaymentError(""); setPaymentNotice("")
    if (!paymentRequestKeys.current[orderId]) paymentRequestKeys.current[orderId] = crypto.randomUUID()
    try {
      const response = await fetch("/api/domains/manual-payment", {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
        body: JSON.stringify({ action: "submit", orderId, idempotencyKey: paymentRequestKeys.current[orderId], transactionReference, customerNote }),
      })
      const result = await response.json()
      if (!response.ok) {
        if (result.code === "unified_billing_in_use") {
          window.location.assign("/portal/bills")
          return
        }
        throw new Error(result.error || "Unable to submit the payment claim.")
      }
      paymentRequestKeys.current[orderId] = ""
      setPaymentNotice("Payment claim submitted for review. This is not a payment confirmation.")
      form.reset()
      await loadOrders()
    } catch (e) {
      setPaymentError(e instanceof Error ? e.message : "Unable to submit the payment claim.")
    } finally { setPaymentBusyOrder("") }
  }

  async function submitRegistrantDetails(event: FormEvent<HTMLFormElement>, orderId: string) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setRegistrantBusyOrder(orderId); setRegistrantError(""); setRegistrantNotice("")
    try {
      const response = await fetch("/api/domains/orders/registrant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          orderId,
          registrantType: String(data.get("registrantType") || "individual"),
          firstName: String(data.get("firstName") || ""),
          lastName: String(data.get("lastName") || ""),
          organisationName: String(data.get("organisationName") || "").trim() || undefined,
          email: String(data.get("email") || ""),
          phone: String(data.get("phone") || ""),
          addressLine1: String(data.get("addressLine1") || ""),
          addressLine2: String(data.get("addressLine2") || "").trim() || undefined,
          city: String(data.get("city") || ""),
          region: String(data.get("region") || ""),
          postalCode: String(data.get("postalCode") || "").trim() || undefined,
          countryCode: String(data.get("countryCode") || ""),
          consentAccepted: data.get("consentAccepted") === "on",
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Registrant details could not be saved.")
      setRegistrantNotice("Registrant details saved. They are only shared with the registrar when we register the domain.")
      setRegistrantEditing((previous) => ({ ...previous, [orderId]: false }))
      await loadOrders()
    } catch (e) {
      setRegistrantError(e instanceof Error ? e.message : "Registrant details could not be saved.")
    } finally {
      setRegistrantBusyOrder("")
    }
  }

  async function requestQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const domainName = quoteDomain.trim().toLowerCase()
    if (!domainName) {
      setQuoteError("Enter the complete domain you want quoted, such as yourbusiness.com.")
      return
    }

    setQuoteError("")
    setQuoteResult(null)
    setQuoteLoading(true)

    // Keep the same key on transport/service failures so a retry can recover
    // a quote that might already have been committed. A successful request
    // clears it, so a later deliberate submission can create a fresh quote.
    if (!quoteRequestKey.current || quoteRequestKey.current.domain !== domainName) {
      quoteRequestKey.current = { domain: domainName, key: crypto.randomUUID() }
    }

    try {
      const response = await fetch("/api/domains/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          domainName,
          idempotencyKey: quoteRequestKey.current.key,
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        setQuoteError(typeof result.error === "string"
          ? result.error
          : "A live quote could not be created. You can still send an enquiry.")
        return
      }
      if (!result.quote || typeof result.quote.domainName !== "string" || !result.order?.id) {
        throw new Error("The quote response could not be confirmed. Retry the same request or contact support.")
      }

      setQuoteResult(result as DomainQuoteResponse)
      quoteRequestKey.current = null
      void loadOrders()
    } catch (requestError) {
      setQuoteError(requestError instanceof Error
        ? requestError.message
        : "A live quote could not be created. You can still send an enquiry.")
    } finally {
      setQuoteLoading(false)
    }
  }

  return (
    <PortalShell title="Domains & orders">
      <main className="mx-auto max-w-5xl px-0 pb-8">
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal">Customer area</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">My domains & orders</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Track domain enquiries and confirmed order status. Prices and registration dates appear only when backed by saved order records.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/domains/sandbox" className="inline-flex h-10 items-center justify-center rounded-xl bg-teal px-4 text-sm font-bold text-navy">Try OTE sandbox</Link>
            <button onClick={() => void loadOrders()} disabled={loading || !user} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold disabled:opacity-50"><RefreshCw className="h-4 w-4" /> Refresh</button>
          </div>
        </div>

        {user && !authLoading ? (
          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal/10 text-teal">
                <Search className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-navy">Request a live domain quote</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  When live registrar access and verified pricing are enabled, we’ll check the exact domain and save a time-limited quote to your account. This does not reserve the domain.
                </p>
              </div>
            </div>

            <form onSubmit={requestQuote} className="mt-5 flex flex-col gap-3 sm:flex-row">
              <div className="min-w-0 flex-1">
                <label htmlFor="live-quote-domain" className="mb-1.5 block text-xs font-bold text-slate-700">Domain name</label>
                <input
                  id="live-quote-domain"
                  name="domainName"
                  value={quoteDomain}
                  onChange={(event) => {
                    setQuoteDomain(event.target.value)
                    setQuoteError("")
                    setQuoteResult(null)
                    quoteRequestKey.current = null
                  }}
                  placeholder="yourbusiness.com"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  maxLength={253}
                  className="h-12 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-teal focus:ring-4 focus:ring-teal/10"
                />
              </div>
              <button
                type="submit"
                disabled={quoteLoading}
                className="mt-auto inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-navy px-5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {quoteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {quoteLoading ? "Checking registrar…" : quoteResult ? "Request another quote" : "Request quote"}
              </button>
            </form>

            <p className="mt-3 text-xs leading-5 text-slate-500">
              Quotes require live registrar confirmation and a current, verified TLD price. Sandbox availability is never treated as live availability.
            </p>

            {quoteError ? (
              <div role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                <p>{quoteError}</p>
                <p className="mt-1">No payment or registration was attempted. You can continue through the enquiry-led flow on <Link href="/domains" className="font-bold underline">the domain enquiry page</Link>.</p>
              </div>
            ) : null}

            {quoteResult ? (
              <div role="status" className="mt-5 rounded-2xl border border-teal/30 bg-teal/5 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-navy">Quote saved for {quoteResult.quote.domainName}</p>
                    <p className="mt-1 text-xs text-slate-500">Order {quoteResult.order.id.slice(0, 8)} · Quote {quoteResult.quote.id.slice(0, 8)}</p>
                    {quoteResult.idempotentReplay ? <p className="mt-1 text-xs text-slate-500">Recovered the original saved quote for this request.</p> : null}
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600">
                    {quoteResult.quote.usable ? "Within quote window" : "Quote expired"}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Metric label="Registration" value={money(quoteResult.quote.registrationPriceMinor, quoteResult.quote.currency)} />
                  <Metric label="Renewal / year" value={money(quoteResult.quote.renewalPriceMinor, quoteResult.quote.currency)} />
                  <Metric label={`Total due · ${quoteResult.quote.termYears} year${quoteResult.quote.termYears === 1 ? "" : "s"}`} value={money(quoteResult.quote.totalDueMinor, quoteResult.quote.currency)} />
                  <Metric label="Quote expiry" value={dateTime(quoteResult.quote.expiresAt)} />
                </div>

                {quoteResult.availability.status === "available_at_check" && quoteResult.availability.checkedAt ? (
                  <p className="mt-4 text-xs leading-5 text-slate-600">
                    The {quoteResult.availability.provider} registrar reported this domain available at {dateTime(quoteResult.availability.checkedAt)}. Availability can change and the domain is not reserved.
                  </p>
                ) : (
                  <p className="mt-4 text-xs leading-5 text-slate-600">A confirmed availability result was not saved with this quote. Contact support before relying on its status.</p>
                )}
                <p className="mt-2 text-xs leading-5 text-slate-600">
                  {quoteResult.message} Payment is manual-only for the initial release; domain registration remains separately gated.
                </p>
                {quoteResult.quote.usable && quoteResult.order.status === "quoted" && !paymentSessions[quoteResult.order.id] ? (
                  <button type="button" onClick={() => void beginManualPayment(quoteResult.order.id)} disabled={!!paymentBusyOrder} className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-navy px-4 text-sm font-bold text-white disabled:opacity-50">
                    {paymentBusyOrder === quoteResult.order.id ? "Loading instructions…" : "Request manual payment instructions"}
                  </button>
                ) : null}
                {paymentSessions[quoteResult.order.id] ? (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-bold text-navy">Manual payment instructions</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600 whitespace-pre-wrap">{paymentSessions[quoteResult.order.id].instructions}</p>
                    <p className="mt-3 text-sm">Reference: <strong>{paymentSessions[quoteResult.order.id].paymentReference}</strong></p>
                    <p className="mt-1 text-sm">Amount: <strong>{money(paymentSessions[quoteResult.order.id].amountMinor, paymentSessions[quoteResult.order.id].currency)}</strong></p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {!authLoading && !user ? (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="font-bold">Sign in to view your domains</h2>
            <p className="mt-2 text-sm text-slate-600">Domain orders are private to the account that owns them.</p>
            <Link href="/login" className="mt-4 inline-flex rounded-xl bg-navy px-4 py-3 text-sm font-bold text-white">Sign in</Link>
          </div>
        ) : null}
        {loading && user ? <div className="flex h-48 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-teal" /></div> : null}
        {error ? <p role="alert" className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</p> : null}
        {paymentError ? <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{paymentError}</p> : null}
        {paymentNotice ? <p role="status" className="mt-4 rounded-xl border border-teal/30 bg-teal/5 p-4 text-sm text-navy">{paymentNotice}</p> : null}
        {registrantError ? <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{registrantError}</p> : null}
        {registrantNotice ? <p role="status" className="mt-4 rounded-xl border border-teal/30 bg-teal/5 p-4 text-sm text-navy">{registrantNotice}</p> : null}

        {!loading && !error && user && orders.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <Globe2 className="mx-auto h-8 w-8 text-teal" />
            <h2 className="mt-4 text-lg font-bold">No domain orders yet</h2>
            <p className="mt-2 text-sm text-slate-600">When domain orders are linked to your account, they will appear here.</p>
            <Link href="/domains" className="mt-5 inline-flex rounded-xl bg-navy px-5 py-3 text-sm font-bold text-white">Explore domains</Link>
          </div>
        ) : null}

        <div className="mt-6 space-y-4">
          {orders.map((order) => (
            <article key={order.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div><h2 className="text-xl font-black">{order.domain_name}</h2><p className="mt-1 text-xs text-slate-500">Order {order.id.slice(0, 8)} · Requested {new Date(order.created_at).toLocaleDateString()}</p></div>
                <span className="w-fit rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">{statusLabel(order.status)}</span>
              </div>
              {order.status === "registered" ? (
                <div className="mt-4">
                  <Link href={`/portal/domains/${order.id}`} className="inline-flex h-10 items-center rounded-xl border border-teal/30 bg-teal/5 px-4 text-sm font-bold text-teal">Manage domain</Link>
                </div>
              ) : null}
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Registration" value={money(order.registration_retail_minor, order.retail_currency)} />
                <Metric label="Renewal" value={money(order.renewal_retail_minor, order.retail_currency)} />
                <Metric label="Registered" value={order.registered_at ? new Date(order.registered_at).toLocaleDateString() : "Not registered"} />
                <Metric label="Expiry" value={order.expires_at ? new Date(order.expires_at).toLocaleDateString() : "Not confirmed"} />
              </div>
              {order.quote_expires_at ? <p className="mt-4 text-xs text-slate-500">Quote expires: {new Date(order.quote_expires_at).toLocaleString()}</p> : null}
              {registrantAvailable ? (
                <RegistrantPanel
                  order={order}
                  details={registrantDetails.find((details) => details.order_id === order.id) ?? null}
                  locked={["registration_pending", "registered"].includes(order.status)}
                  editing={registrantEditing[order.id] === true}
                  busy={registrantBusyOrder === order.id}
                  onToggle={() => setRegistrantEditing((previous) => ({ ...previous, [order.id]: !previous[order.id] }))}
                  onSubmit={(event) => void submitRegistrantDetails(event, order.id)}
                />
              ) : (
                <p role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-950">
                  Registrant details cannot be captured in this environment yet, so this domain cannot accept a payment claim. Payment and registration stay disabled until the registrant details feature is deployed — contact support if this is blocking you.
                </p>
              )}
              {(order.status === "quoted" || order.status === "awaiting_payment") ? (
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-slate-600">Initial payments are handled manually. Use the current quote and wait for payment verification.</p>
                    <button type="button" onClick={() => void beginManualPayment(order.id)} disabled={!!paymentBusyOrder} className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-bold disabled:opacity-50">
                      {paymentBusyOrder === order.id ? "Loading…" : "View payment instructions"}
                    </button>
                  </div>
                  {paymentSessions[order.id] ? (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-bold">Payment reference: {paymentSessions[order.id].paymentReference}</p>
                      <p className="mt-1 text-sm font-bold">Amount: {money(paymentSessions[order.id].amountMinor, paymentSessions[order.id].currency)}</p>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{paymentSessions[order.id].instructions}</p>
                      {!paymentClaims.some((claim) => claim.order_id === order.id && ["submitted", "verified"].includes(claim.status)) ? (
                        <form onSubmit={(event) => void submitManualPaymentClaim(event, order.id)} className="mt-4 space-y-3">
                          <div><label htmlFor={`transaction-${order.id}`} className="block text-xs font-bold text-slate-700">Transfer / transaction reference</label><input id={`transaction-${order.id}`} name="transactionReference" required minLength={3} maxLength={120} autoComplete="off" className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" placeholder="Reference from your bank or mobile-money provider" /></div>
                          <div><label htmlFor={`note-${order.id}`} className="block text-xs font-bold text-slate-700">Optional note</label><textarea id={`note-${order.id}`} name="customerNote" maxLength={500} rows={2} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm" placeholder="Optional details to help us reconcile the payment" /></div>
                          <p className="text-xs leading-5 text-slate-500">Do not upload or send PINs, passwords, card details, or banking credentials. A submitted claim is not proof of payment.</p>
                          <button type="submit" disabled={!!paymentBusyOrder} className="inline-flex h-10 items-center justify-center rounded-xl bg-navy px-4 text-sm font-bold text-white disabled:opacity-50">{paymentBusyOrder === order.id ? "Submitting…" : "Submit payment claim"}</button>
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                  {paymentClaims.filter((claim) => claim.order_id === order.id).map((claim) => (
                    <div key={claim.id} className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm">
                      <p className="font-bold">Payment claim: {statusLabel(claim.status)}</p>
                      <p className="mt-1 text-xs text-slate-500">Reference {claim.payment_reference} · Transaction {claim.transaction_reference}</p>
                      {claim.review_note ? <p className="mt-2 text-slate-600">Review note: {claim.review_note}</p> : null}
                      {claim.status === "verified" ? <p className="mt-2 text-xs text-teal">Funds were verified by HEMBOX TECH. This does not mean the domain has been registered.</p> : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </main>
    </PortalShell>
  )
}


type RegistrantPanelProps = {
  order: DomainOrder
  details: RegistrantDetails | null
  locked: boolean
  editing: boolean
  busy: boolean
  onToggle: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

function fieldClass() {
  return "mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
}

function RegistrantPanel({ order, details, locked, editing, busy, onToggle, onSubmit }: RegistrantPanelProps) {
  const showForm = !details || editing
  return (
    <section className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-navy">Registrant details</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            {details
              ? `Saved for ${details.first_name} ${details.last_name}${details.organisation_name ? ` · ${details.organisation_name}` : ""} · consent ${details.consent_version} accepted ${new Date(details.consent_accepted_at).toLocaleDateString()}`
              : "The registrar needs the legal owner's contact details. These are required before payment and before the domain can be registered."}
          </p>
        </div>
        {!locked ? (
          <button type="button" onClick={onToggle} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold">
            {editing ? "Cancel" : details ? "Update details" : "Add details"}
          </button>
        ) : null}
      </div>

      {!showForm ? (
        <dl className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
          <div><dt className="font-semibold text-slate-500">Contact</dt><dd>{details?.email} · {details?.phone}</dd></div>
          <div><dt className="font-semibold text-slate-500">Country</dt><dd>{details?.country_code}</dd></div>
          <div className="sm:col-span-2"><dt className="font-semibold text-slate-500">Postal address</dt><dd>{[details?.address_line1, details?.address_line2, details?.city, details?.region, details?.postal_code].filter(Boolean).join(", ")}</dd></div>
        </dl>
      ) : (
        <form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="registrantType" value={details?.registrant_type ?? "individual"} />
          <div><label htmlFor={`first-name-${order.id}`} className="block text-xs font-bold text-slate-700">First name</label><input id={`first-name-${order.id}`} name="firstName" required maxLength={60} defaultValue={details?.first_name ?? ""} className={fieldClass()} /></div>
          <div><label htmlFor={`last-name-${order.id}`} className="block text-xs font-bold text-slate-700">Last name</label><input id={`last-name-${order.id}`} name="lastName" required maxLength={60} defaultValue={details?.last_name ?? ""} className={fieldClass()} /></div>
          <div className="sm:col-span-2"><label htmlFor={`organisation-${order.id}`} className="block text-xs font-bold text-slate-700">Organisation (optional)</label><input id={`organisation-${order.id}`} name="organisationName" maxLength={120} defaultValue={details?.organisation_name ?? ""} className={fieldClass()} placeholder="Leave blank to register as an individual" /></div>
          <div><label htmlFor={`email-${order.id}`} className="block text-xs font-bold text-slate-700">Email</label><input id={`email-${order.id}`} name="email" type="email" required maxLength={254} defaultValue={details?.email ?? ""} className={fieldClass()} /></div>
          <div><label htmlFor={`phone-${order.id}`} className="block text-xs font-bold text-slate-700">Phone (international)</label><input id={`phone-${order.id}`} name="phone" required maxLength={20} defaultValue={details?.phone ?? ""} className={fieldClass()} placeholder="+260970000000" /></div>
          <div className="sm:col-span-2"><label htmlFor={`address-${order.id}`} className="block text-xs font-bold text-slate-700">Address line 1</label><input id={`address-${order.id}`} name="addressLine1" required minLength={3} maxLength={120} defaultValue={details?.address_line1 ?? ""} className={fieldClass()} /></div>
          <div className="sm:col-span-2"><label htmlFor={`address2-${order.id}`} className="block text-xs font-bold text-slate-700">Address line 2 (optional)</label><input id={`address2-${order.id}`} name="addressLine2" maxLength={120} defaultValue={details?.address_line2 ?? ""} className={fieldClass()} /></div>
          <div><label htmlFor={`city-${order.id}`} className="block text-xs font-bold text-slate-700">City</label><input id={`city-${order.id}`} name="city" required minLength={2} maxLength={80} defaultValue={details?.city ?? ""} className={fieldClass()} /></div>
          <div><label htmlFor={`region-${order.id}`} className="block text-xs font-bold text-slate-700">Province / region</label><input id={`region-${order.id}`} name="region" required minLength={2} maxLength={80} defaultValue={details?.region ?? "Lusaka"} className={fieldClass()} /></div>
          <div><label htmlFor={`postal-${order.id}`} className="block text-xs font-bold text-slate-700">Postal code (optional)</label><input id={`postal-${order.id}`} name="postalCode" maxLength={20} defaultValue={details?.postal_code ?? ""} className={fieldClass()} /></div>
          <div><label htmlFor={`country-${order.id}`} className="block text-xs font-bold text-slate-700">Country code</label><input id={`country-${order.id}`} name="countryCode" required pattern="[A-Za-z]{2}" maxLength={2} defaultValue={details?.country_code ?? "ZM"} className={fieldClass()} placeholder="ZM" /></div>
          <label className="flex items-start gap-2 rounded-xl bg-white p-3 text-xs leading-5 text-slate-600 sm:col-span-2">
            <input name="consentAccepted" type="checkbox" required className="mt-0.5" defaultChecked={Boolean(details)} />
            <span>I confirm these details belong to the legal registrant, and I consent to them being shared with the domain registrar (NameSilo) and published where registry or WHOIS policy requires it.</span>
          </label>
          <div className="sm:col-span-2">
            <button type="submit" disabled={busy} className="inline-flex h-10 items-center justify-center rounded-xl bg-navy px-4 text-sm font-bold text-white disabled:opacity-50">
              {busy ? "Saving\u2026" : "Save registrant details"}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 text-sm font-bold text-navy">{value}</p></div>
}
