"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import type { FormEvent, ReactNode } from "react"
import { ArrowUpRight, Clock3, Globe2, Loader2, RefreshCw } from "lucide-react"
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
type RegistrantProfile = Pick<RegistrantDetails, "registrant_type" | "first_name" | "last_name" | "organisation_name" | "email" | "phone" | "address_line1" | "address_line2" | "city" | "region" | "postal_code" | "country_code">
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

const terminalStatuses = new Set(["cancelled", "expired", "registration_failed", "rejected"])

function dateLabel(value: string | null) {
  if (!value) return "Not recorded"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleDateString()
}
function money(minor: number | null, currency: string) {
  if (minor === null) return "Awaiting confirmed quote"
  try {
    return new Intl.NumberFormat("en-ZM", { style: "currency", currency: currency || "ZMW", maximumFractionDigits: 2 }).format(minor / 100)
  } catch {
    return (currency || "ZMW") + " " + (minor / 100).toFixed(2)
  }
}
function statusLabel(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}
function daysUntil(value: string | null) {
  if (!value) return null
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return null
  return Math.ceil((time - Date.now()) / 86400000)
}
function fieldClass() {
  return "mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
}

export default function CustomerDomainsPage() {
  const { user, isLoading: authLoading } = useAuth()
  const [orders, setOrders] = useState<DomainOrder[]>([])
  const [paymentClaims, setPaymentClaims] = useState<ManualPaymentClaim[]>([])
  const [registrantDetails, setRegistrantDetails] = useState<RegistrantDetails[]>([])
  const [registrantProfile, setRegistrantProfile] = useState<RegistrantProfile | null>(null)
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

  const loadOrders = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/domains/orders", { cache: "no-store" })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to load your domains.")
      setOrders(result.orders ?? [])
      setPaymentClaims(result.paymentClaims ?? [])
      setRegistrantDetails(result.registrantDetails ?? [])
      setRegistrantAvailable(result.registrantDetailsAvailable !== false)
      const profileResponse = await fetch("/api/portal/settings/registrant", { cache: "no-store" })
      const profileResult = await profileResponse.json().catch(() => ({}))
      setRegistrantProfile(profileResponse.ok ? profileResult.profile ?? null : null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load your domains.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading && user) void loadOrders()
    if (!authLoading && !user) setLoading(false)
  }, [authLoading, user, loadOrders])

  async function beginManualPayment(orderId: string) {
    setPaymentBusyOrder(orderId)
    setPaymentError("")
    setPaymentNotice("")
    try {
      const response = await fetch("/api/domains/manual-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
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
      setPaymentSessions((previous) => ({
        ...previous,
        [orderId]: {
          paymentReference: result.paymentReference,
          amountMinor: result.amountMinor,
          currency: result.currency,
          instructions: result.instructions,
        },
      }))
      setPaymentNotice("Use the exact order reference in your transfer. Payment is not confirmed until HEMBOX verifies settled funds.")
      void loadOrders()
    } catch (e) {
      setPaymentError(e instanceof Error ? e.message : "Manual payment instructions are unavailable.")
    } finally {
      setPaymentBusyOrder("")
    }
  }

  async function submitManualPaymentClaim(event: FormEvent<HTMLFormElement>, orderId: string) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const transactionReference = String(data.get("transactionReference") || "").trim()
    const customerNote = String(data.get("customerNote") || "").trim()
    if (!transactionReference) {
      setPaymentError("Enter the transaction reference shown by your payment provider.")
      return
    }
    setPaymentBusyOrder(orderId)
    setPaymentError("")
    setPaymentNotice("")
    if (!paymentRequestKeys.current[orderId]) paymentRequestKeys.current[orderId] = crypto.randomUUID()
    try {
      const response = await fetch("/api/domains/manual-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          action: "submit",
          orderId,
          idempotencyKey: paymentRequestKeys.current[orderId],
          transactionReference,
          customerNote,
        }),
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
    } finally {
      setPaymentBusyOrder("")
    }
  }

  async function submitRegistrantDetails(event: FormEvent<HTMLFormElement>, orderId: string) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setRegistrantBusyOrder(orderId)
    setRegistrantError("")
    setRegistrantNotice("")
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
      setRegistrantNotice("Registrant details saved. They are shared with the registrar only when needed to register the domain.")
      setRegistrantEditing((previous) => ({ ...previous, [orderId]: false }))
      await loadOrders()
    } catch (e) {
      setRegistrantError(e instanceof Error ? e.message : "Registrant details could not be saved.")
    } finally {
      setRegistrantBusyOrder("")
    }
  }

  const registeredDomains = orders.filter((order) => order.status === "registered")
  const processingOrders = orders.filter((order) => order.status !== "registered" && !terminalStatuses.has(order.status))
  const previousOrders = orders.filter((order) => terminalStatuses.has(order.status))
  const expiringSoon = registeredDomains.filter((order) => {
    const days = daysUntil(order.expires_at)
    return days !== null && days >= 0 && days <= 30
  }).length

  return (
    <PortalShell title="My domains">
      <main className="mx-auto max-w-5xl px-0 pb-10">
        <header className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal">Customer area</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-navy sm:text-4xl">My domains</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Manage domains you own and follow new domain orders from one place.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/domains" className="inline-flex h-10 items-center gap-2 rounded-xl bg-navy px-4 text-sm font-bold text-white">
              Find a domain <ArrowUpRight className="h-4 w-4" />
            </Link>
            <button type="button" onClick={() => void loadOrders()} disabled={loading || !user} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold disabled:opacity-50">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>
        </header>

        {!authLoading && !user ? (
          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="font-bold text-navy">Sign in to view your domains</h2>
            <p className="mt-2 text-sm text-slate-600">Domain records and order details are private to the account that owns them.</p>
            <Link href="/login" className="mt-4 inline-flex rounded-xl bg-navy px-4 py-3 text-sm font-bold text-white">Sign in</Link>
          </section>
        ) : null}

        {user && !authLoading ? (
          <>
            <section aria-label="Domain account summary" className="mt-7 grid gap-3 sm:grid-cols-3">
              <SummaryMetric label="Registered domains" value={String(registeredDomains.length)} icon={<Globe2 className="h-4 w-4" />} />
              <SummaryMetric label="Expiring in 30 days" value={String(expiringSoon)} icon={<Clock3 className="h-4 w-4" />} />
              <SummaryMetric label="Orders in progress" value={String(processingOrders.length)} icon={<RefreshCw className="h-4 w-4" />} />
            </section>

            {error ? <p role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</p> : null}
            {paymentError ? <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{paymentError}</p> : null}
            {paymentNotice ? <p role="status" className="mt-4 rounded-xl border border-teal/30 bg-teal/5 p-4 text-sm text-navy">{paymentNotice}</p> : null}
            {registrantError ? <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{registrantError}</p> : null}
            {registrantNotice ? <p role="status" className="mt-4 rounded-xl border border-teal/30 bg-teal/5 p-4 text-sm text-navy">{registrantNotice}</p> : null}

            {loading ? <div className="flex h-36 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-teal" /></div> : null}

            {!loading && !error ? (
              <>
                <section className="mt-8">
                  <div className="mb-4 flex items-end justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-black text-navy">Registered domains</h2>
                      <p className="mt-1 text-sm text-slate-500">Domains confirmed as registered to your account.</p>
                    </div>
                    <span className="text-sm font-semibold text-slate-500">{registeredDomains.length}</span>
                  </div>
                  {registeredDomains.length ? (
                    <div className="space-y-3">
                      {registeredDomains.map((order) => {
                        const days = daysUntil(order.expires_at)
                        return (
                          <article key={order.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0">
                                <h3 className="break-all text-lg font-black text-navy">{order.domain_name}</h3>
                                <p className="mt-1 text-xs text-slate-500">Registered {dateLabel(order.registered_at)} · Expires {dateLabel(order.expires_at)}</p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                {days !== null && days >= 0 && days <= 30 ? <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">Expires in {days} days</span> : null}
                                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">Registered</span>
                                <Link href={"/portal/domains/" + order.id} className="inline-flex h-9 items-center rounded-xl border border-slate-200 px-3 text-sm font-bold text-navy hover:border-teal">
                                  Manage <ArrowUpRight className="ml-1 h-4 w-4" />
                                </Link>
                              </div>
                            </div>
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              <DetailMetric label="Registration" value={money(order.registration_retail_minor, order.retail_currency)} />
                              <DetailMetric label="Renewal per year" value={money(order.renewal_retail_minor, order.retail_currency)} />
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  ) : (
                    <EmptySection title="No registered domains yet" description="Once a domain registration is confirmed, it will appear here." action={<Link href="/domains" className="font-bold text-teal hover:underline">Search for a domain</Link>} />
                  )}
                </section>

                <section className="mt-9">
                  <div className="mb-4 flex items-end justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-black text-navy">Orders in progress</h2>
                      <p className="mt-1 text-sm text-slate-500">Quotes, payment review and registrations that are not yet complete.</p>
                    </div>
                    <Link href="/portal/bills" className="text-sm font-bold text-teal hover:underline">View billing</Link>
                  </div>
                  {processingOrders.length ? (
                    <div className="space-y-3">
                      {processingOrders.map((order) => {
                        const details = registrantDetails.find((item) => item.order_id === order.id) ?? null
                        const claims = paymentClaims.filter((claim) => claim.order_id === order.id)
                        const activeClaim = claims.find((claim) => ["submitted", "verified"].includes(claim.status))
                        const paymentSession = paymentSessions[order.id]
                        return (
                          <article key={order.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <h3 className="break-all text-lg font-black text-navy">{order.domain_name}</h3>
                                <p className="mt-1 text-xs text-slate-500">Order {order.id.slice(0, 8)} · Created {dateLabel(order.created_at)}</p>
                              </div>
                              <span className="w-fit rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">{statusLabel(order.status)}</span>
                            </div>
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              <DetailMetric label="Registration" value={money(order.registration_retail_minor, order.retail_currency)} />
                              <DetailMetric label="Renewal" value={money(order.renewal_retail_minor, order.retail_currency)} />
                            </div>
                            {order.quote_expires_at ? <p className="mt-3 text-xs text-slate-500">Quote expires {dateLabel(order.quote_expires_at)}.</p> : null}

                            {registrantAvailable ? (
                              <RegistrantPanel
                                order={order}
                                details={details}
                                profile={registrantProfile}
                                locked={["registration_pending", "registered"].includes(order.status)}
                                editing={registrantEditing[order.id] === true}
                                busy={registrantBusyOrder === order.id}
                                onToggle={() => setRegistrantEditing((previous) => ({ ...previous, [order.id]: !previous[order.id] }))}
                                onSubmit={(event) => void submitRegistrantDetails(event, order.id)}
                              />
                            ) : (
                              <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
                                Registrant details are temporarily unavailable. Payment and registration cannot proceed until this is resolved.
                              </p>
                            )}

                            {["quoted", "awaiting_payment"].includes(order.status) ? (
                              <div className="mt-4 border-t border-slate-100 pt-4">
                                {activeClaim ? (
                                  <p className="text-sm text-slate-600">Payment claim: <strong>{statusLabel(activeClaim.status)}</strong>. {activeClaim.status === "verified" ? "Funds have been verified; domain registration is still a separate step." : "Your claim is awaiting review."}</p>
                                ) : (
                                  <button type="button" onClick={() => void beginManualPayment(order.id)} disabled={!!paymentBusyOrder || !details} className="inline-flex h-10 items-center rounded-xl bg-navy px-4 text-sm font-bold text-white disabled:opacity-50">
                                    {paymentBusyOrder === order.id ? "Loading instructions…" : "View payment instructions"}
                                  </button>
                                )}
                                {paymentSession ? (
                                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                                    <p className="text-sm font-bold text-navy">Payment reference: {paymentSession.paymentReference}</p>
                                    <p className="mt-1 text-sm font-bold text-navy">Amount: {money(paymentSession.amountMinor, paymentSession.currency)}</p>
                                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{paymentSession.instructions}</p>
                                    {!activeClaim ? (
                                      <form onSubmit={(event) => void submitManualPaymentClaim(event, order.id)} className="mt-4 space-y-3">
                                        <div>
                                          <label htmlFor={"transaction-" + order.id} className="block text-xs font-bold text-slate-700">Transfer / transaction reference</label>
                                          <input id={"transaction-" + order.id} name="transactionReference" required minLength={3} maxLength={120} autoComplete="off" className={fieldClass()} placeholder="Reference from your bank or mobile-money provider" />
                                        </div>
                                        <div>
                                          <label htmlFor={"note-" + order.id} className="block text-xs font-bold text-slate-700">Optional note</label>
                                          <textarea id={"note-" + order.id} name="customerNote" maxLength={500} rows={2} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm" placeholder="Optional details to help us reconcile the payment" />
                                        </div>
                                        <p className="text-xs leading-5 text-slate-500">A submitted claim is not proof of payment. Never share PINs, passwords or banking credentials.</p>
                                        <button type="submit" disabled={!!paymentBusyOrder} className="inline-flex h-10 items-center rounded-xl bg-navy px-4 text-sm font-bold text-white disabled:opacity-50">
                                          {paymentBusyOrder === order.id ? "Submitting…" : "Submit payment claim"}
                                        </button>
                                      </form>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            ) : null}

                            {claims.map((claim) => (
                              <div key={claim.id} className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                                <div className="flex flex-wrap justify-between gap-2">
                                  <p className="font-bold text-navy">Payment claim · {statusLabel(claim.status)}</p>
                                  <span className="text-xs text-slate-500">{dateLabel(claim.updated_at)}</span>
                                </div>
                                <p className="mt-1 text-xs text-slate-500">Payment reference {claim.payment_reference} · Transaction {claim.transaction_reference}</p>
                                {claim.review_note ? <p className="mt-2 text-sm text-slate-600">Review note: {claim.review_note}</p> : null}
                              </div>
                            ))}
                          </article>
                        )
                      })}
                    </div>
                  ) : (
                    <EmptySection title="No orders in progress" description="New domain orders will appear here while payment and registration are being completed." action={<Link href="/domains" className="font-bold text-teal hover:underline">Find your next domain</Link>} />
                  )}
                </section>

                {previousOrders.length ? (
                  <section className="mt-9">
                    <h2 className="text-lg font-black text-navy">Previous orders</h2>
                    <div className="mt-3 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-5">
                      {previousOrders.map((order) => (
                        <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                          <div><p className="font-bold text-navy">{order.domain_name}</p><p className="mt-1 text-xs text-slate-500">Order {order.id.slice(0, 8)}</p></div>
                          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">{statusLabel(order.status)}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}
      </main>
    </PortalShell>
  )
}

function SummaryMetric({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between text-slate-500"><p className="text-xs font-semibold">{label}</p><span className="text-teal">{icon}</span></div>
      <p className="mt-2 text-2xl font-black tabular-nums text-navy">{value}</p>
    </div>
  )
}
function DetailMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 text-sm font-bold text-navy">{value}</p></div>
}
function EmptySection({ title, description, action }: { title: string; description: string; action: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
      <Globe2 className="mx-auto h-7 w-7 text-slate-400" />
      <h3 className="mt-3 font-bold text-navy">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
      <div className="mt-3 text-sm">{action}</div>
    </div>
  )
}

type RegistrantPanelProps = {
  order: DomainOrder
  details: RegistrantDetails | null
  profile: RegistrantProfile | null
  locked: boolean
  editing: boolean
  busy: boolean
  onToggle: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}
function RegistrantPanel({ order, details, profile, locked, editing, busy, onToggle, onSubmit }: RegistrantPanelProps) {
  const showForm = !locked && (editing || !details)
  return (
    <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-navy">Registrant details</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            {details
              ? "Registrant details are saved for this order and are hidden here."
              : "Required before payment and registration. You can reveal the form when needed."}
          </p>
        </div>
        {!locked ? (
          <button type="button" onClick={onToggle} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold">
            {showForm ? "Hide registrant details" : "Show registrant details"}
          </button>
        ) : null}
      </div>
      {!showForm ? (
        <p className="mt-3 text-xs text-slate-600">
          {details ? "Registrant details are saved for this order and are hidden here." : "No registrant details have been saved for this account yet."}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div><label htmlFor={"registrant-type-" + order.id} className="block text-xs font-bold text-slate-700">Registrant type</label><select id={"registrant-type-" + order.id} name="registrantType" defaultValue={details?.registrant_type ?? profile?.registrant_type ?? "individual"} className={fieldClass()}><option value="individual">Individual</option><option value="organisation">Organisation</option></select></div>
          <div><label htmlFor={"first-name-" + order.id} className="block text-xs font-bold text-slate-700">First name</label><input id={"first-name-" + order.id} name="firstName" required maxLength={60} defaultValue={details?.first_name ?? profile?.first_name ?? ""} className={fieldClass()} /></div>
          <div><label htmlFor={"last-name-" + order.id} className="block text-xs font-bold text-slate-700">Last name</label><input id={"last-name-" + order.id} name="lastName" required maxLength={60} defaultValue={details?.last_name ?? profile?.last_name ?? ""} className={fieldClass()} /></div>
          <div className="sm:col-span-2"><label htmlFor={"organisation-" + order.id} className="block text-xs font-bold text-slate-700">Organisation name</label><input id={"organisation-" + order.id} name="organisationName" maxLength={120} defaultValue={details?.organisation_name ?? profile?.organisation_name ?? ""} className={fieldClass()} /></div>
          <div><label htmlFor={"email-" + order.id} className="block text-xs font-bold text-slate-700">Email</label><input id={"email-" + order.id} name="email" type="email" required maxLength={254} defaultValue={details?.email ?? profile?.email ?? ""} className={fieldClass()} /></div>
          <div><label htmlFor={"phone-" + order.id} className="block text-xs font-bold text-slate-700">Phone (international)</label><input id={"phone-" + order.id} name="phone" required maxLength={20} defaultValue={details?.phone ?? profile?.phone ?? ""} className={fieldClass()} placeholder="+260970000000" /></div>
          <div className="sm:col-span-2"><label htmlFor={"address-" + order.id} className="block text-xs font-bold text-slate-700">Address line 1</label><input id={"address-" + order.id} name="addressLine1" required minLength={3} maxLength={120} defaultValue={details?.address_line1 ?? profile?.address_line1 ?? ""} className={fieldClass()} /></div>
          <div className="sm:col-span-2"><label htmlFor={"address2-" + order.id} className="block text-xs font-bold text-slate-700">Address line 2 (optional)</label><input id={"address2-" + order.id} name="addressLine2" maxLength={120} defaultValue={details?.address_line2 ?? profile?.address_line2 ?? ""} className={fieldClass()} /></div>
          <div><label htmlFor={"city-" + order.id} className="block text-xs font-bold text-slate-700">City</label><input id={"city-" + order.id} name="city" required minLength={2} maxLength={80} defaultValue={details?.city ?? profile?.city ?? ""} className={fieldClass()} /></div>
          <div><label htmlFor={"region-" + order.id} className="block text-xs font-bold text-slate-700">Province / region</label><input id={"region-" + order.id} name="region" required minLength={2} maxLength={80} defaultValue={details?.region ?? profile?.region ?? "Lusaka"} className={fieldClass()} /></div>
          <div><label htmlFor={"postal-" + order.id} className="block text-xs font-bold text-slate-700">Postal code (optional)</label><input id={"postal-" + order.id} name="postalCode" maxLength={20} defaultValue={details?.postal_code ?? profile?.postal_code ?? ""} className={fieldClass()} /></div>
          <div><label htmlFor={"country-" + order.id} className="block text-xs font-bold text-slate-700">Country code</label><input id={"country-" + order.id} name="countryCode" required pattern="[A-Za-z]{2}" maxLength={2} defaultValue={details?.country_code ?? profile?.country_code ?? "ZM"} className={fieldClass()} placeholder="ZM" /></div>
          <label className="flex items-start gap-2 rounded-xl bg-white p-3 text-xs leading-5 text-slate-600 sm:col-span-2">
            <input name="consentAccepted" type="checkbox" required className="mt-0.5" defaultChecked={Boolean(details)} />
            <span>I confirm these details belong to the legal registrant, and consent to sharing them with the domain registrar and publication where registry policy requires it.</span>
          </label>
          <div className="sm:col-span-2"><button type="submit" disabled={busy} className="inline-flex h-10 items-center rounded-xl bg-navy px-4 text-sm font-bold text-white disabled:opacity-50">{busy ? "Saving…" : "Save registrant details"}</button></div>
        </form>
      )}
    </section>
  )
}
