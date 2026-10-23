"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import type { FormEvent } from "react"
import { ArrowLeft, CheckCircle2, Globe2, Loader2, RefreshCw, Search } from "lucide-react"
import { Navbar } from "@/components/landing/navbar"
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
    <div className="min-h-screen bg-slate-50 text-navy">
      <Navbar />
      <main className="mx-auto max-w-5xl px-5 pb-20 pt-32 sm:px-8">
        <Link href="/profile" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-teal"><ArrowLeft className="h-4 w-4" /> Back to profile</Link>
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal">Customer area</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">My domains & orders</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Track domain enquiries and confirmed order status. Prices and registration dates appear only when backed by saved order records.</p>
          </div>
          <button onClick={() => void loadOrders()} disabled={loading || !user} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold disabled:opacity-50"><RefreshCw className="h-4 w-4" /> Refresh</button>
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
                  {quoteResult.message} Checkout and registration remain disabled.
                </p>
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
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Registration" value={money(order.registration_retail_minor, order.retail_currency)} />
                <Metric label="Renewal" value={money(order.renewal_retail_minor, order.retail_currency)} />
                <Metric label="Registered" value={order.registered_at ? new Date(order.registered_at).toLocaleDateString() : "Not registered"} />
                <Metric label="Expiry" value={order.expires_at ? new Date(order.expires_at).toLocaleDateString() : "Not confirmed"} />
              </div>
              {order.quote_expires_at ? <p className="mt-4 text-xs text-slate-500">Quote expires: {new Date(order.quote_expires_at).toLocaleString()}</p> : null}
            </article>
          ))}
        </div>
      </main>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 text-sm font-bold text-navy">{value}</p></div>
}
