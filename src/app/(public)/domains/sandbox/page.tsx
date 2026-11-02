"use client"

import { useCallback, useEffect, useState } from "react"
import type { FormEvent } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, Globe2, Loader2, ShieldCheck } from "lucide-react"
import { Navbar } from "@/components/landing/navbar"
import { Footer } from "@/components/landing/footer"

type Order = {
  id: string; domain_name: string; term_years: number; status: string
  payment_mode: string; payment_status: string; registered_at: string | null
  expires_at: string | null; nameservers: string[]; last_provider_message: string | null
}
const emptyRegistrant = {
  firstName: "", lastName: "", organisationName: "", email: "", phone: "+260",
  addressLine1: "", addressLine2: "", city: "", region: "", postalCode: "", countryCode: "ZM",
}
const inputClass = "mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal focus:ring-4 focus:ring-teal/10"

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-ZM", { year: "numeric", month: "long", day: "numeric" }) : "Not confirmed"
}

export default function DomainSandboxPage() {
  const [domainName, setDomainName] = useState("")
  const [availability, setAvailability] = useState<"available" | "unavailable" | "unknown" | "idle">("idle")
  const [availabilityMessage, setAvailabilityMessage] = useState("")
  const [checking, setChecking] = useState(false)
  const [registrant, setRegistrant] = useState(emptyRegistrant)
  const [termYears, setTermYears] = useState(1)
  const [consent, setConsent] = useState(false)
  const [order, setOrder] = useState<Order | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const loadOrders = useCallback(async () => {
    const response = await fetch("/api/domains/sandbox/orders", { cache: "no-store" })
    const body = await response.json()
    if (response.ok) setOrders(body.orders ?? [])
    else setError(body.error ?? "Could not load sandbox orders.")
  }, [])

  useEffect(() => {
    loadOrders().finally(() => setLoading(false))
  }, [loadOrders])

  async function searchDomain(event: FormEvent) {
    event.preventDefault()
    setError(""); setNotice(""); setAvailability("idle"); setChecking(true); setOrder(null)
    try {
      const response = await fetch("/api/domains/sandbox/search", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainName: domainName.trim().toLowerCase() }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? "Availability check failed.")
      setAvailability(body.result.availability)
      setAvailabilityMessage(body.result.message)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Availability check failed.")
    } finally { setChecking(false) }
  }

  async function createOrder(event: React.FormEvent) {
    event.preventDefault(); setError(""); setNotice(""); setBusy(true)
    try {
      const response = await fetch("/api/domains/sandbox/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domainName: domainName.trim().toLowerCase(), termYears,
          idempotencyKey: crypto.randomUUID(),
          registrant: { ...registrant, consentAccepted: consent },
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? "Could not create the sandbox order.")
      setOrder(body.order); setNotice("Sandbox order created. Review the no-charge payment step below.")
      await loadOrders()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the sandbox order.")
    } finally { setBusy(false) }
  }

  async function registerOrder() {
    if (!order) return
    setError(""); setNotice(""); setBusy(true)
    try {
      const response = await fetch(`/api/domains/sandbox/orders/${order.id}/register`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmSandboxPayment: true }),
      })
      const body = await response.json()
      if (!response.ok && response.status !== 202) throw new Error(body.error ?? "Sandbox registration failed.")
      if (body.order) setOrder(body.order)
      else setOrder((current) => current ? { ...current, status: body.orderStatus ?? "registration_unknown", last_provider_message: body.error } : current)
      setNotice(body.registered ? "NameSilo OTE confirmed the domain registration. It now appears in your sandbox domain portfolio." : body.error ?? "The provider response needs reconciliation.")
      await loadOrders()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sandbox registration failed.")
    } finally { setBusy(false) }
  }

  const signedOut = error.toLowerCase().includes("sign in")
  return (
    <div className="min-h-screen bg-slate-50 text-navy">
      <Navbar />
      <main className="mx-auto max-w-5xl px-5 pb-20 pt-32 sm:px-8">
        <Link href="/domains" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-teal"><ArrowLeft className="h-4 w-4" /> Domain storefront</Link>
        <div className="mt-7 rounded-3xl bg-navy p-6 text-white sm:p-9">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal/30 bg-teal/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-teal"><Globe2 className="h-4 w-4" /> NameSilo OTE sandbox</div>
          <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">Buy, own and manage a test domain.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">This is the real customer UI connected to NameSilo’s test environment. Search, create a test order, submit a simulated HEMBOX payment, register through OTE, then manage the domain. Nothing here registers a live domain or collects customer payment.</p>
          <div className="mt-6 flex flex-wrap gap-3 text-xs text-slate-300"><span className="rounded-lg bg-white/10 px-3 py-2">Provider: NameSilo OTE</span><span className="rounded-lg bg-white/10 px-3 py-2">Supported: .com / .net</span><span className="rounded-lg bg-white/10 px-3 py-2">Payment: simulated, K0.00</span></div>
        </div>

        {error ? <div role="alert" className="mt-5 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><CircleAlert className="h-5 w-5 shrink-0" /> <div>{error}{signedOut ? <p className="mt-2"><Link className="font-bold underline" href="/login">Sign in</Link> to continue your sandbox purchase.</p> : null}</div></div> : null}
        {notice ? <div role="status" className="mt-5 flex gap-2 rounded-xl border border-teal/30 bg-teal/10 p-4 text-sm text-slate-800"><CheckCircle2 className="h-5 w-5 shrink-0 text-teal" />{notice}</div> : null}

        <section className="mt-7 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div><p className="text-xs font-bold uppercase tracking-wider text-teal">Step 1 · Search</p><h2 className="mt-1 text-xl font-black">Find your domain</h2><p className="mt-1 text-sm text-slate-500">Availability is queried directly from NameSilo OTE. It is not a live-registry guarantee.</p></div>
          <form onSubmit={searchDomain} className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input value={domainName} onChange={(e) => { setDomainName(e.target.value); setAvailability("idle"); setOrder(null) }} placeholder="yourbrand.com" autoCapitalize="none" autoCorrect="off" className="h-12 min-w-0 flex-1 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-teal focus:ring-4 focus:ring-teal/10" required />
            <button disabled={checking} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-navy px-5 text-sm font-bold text-white disabled:opacity-50">{checking ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Check OTE availability</button>
          </form>
          {availability !== "idle" ? <div className={`mt-4 rounded-xl p-4 text-sm ${availability === "available" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}><p className="font-bold">{availability === "available" ? "Reported available in OTE" : availability === "unavailable" ? "Not available in OTE" : "Availability not confirmed"}</p><p className="mt-1">{availabilityMessage}</p></div> : null}
        </section>

        {availability === "available" && !order ? <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <p className="text-xs font-bold uppercase tracking-wider text-teal">Step 2 · Registrant and order</p><h2 className="mt-1 text-xl font-black">Who will own {domainName.toLowerCase()}?</h2>
          <p className="mt-2 text-sm text-slate-500">For this first OTE journey, registrant contact data is limited to Zambia (+260). It is sent to NameSilo OTE only after you accept the consent below.</p>
          <form onSubmit={createOrder} className="mt-5 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {([["firstName","First name"],["lastName","Last name"],["organisationName","Organisation (optional)"],["email","Registrant email"],["phone","Phone (+260 97X XXX XXX)"],["addressLine1","Address"],["addressLine2","Address line 2 (optional)"],["city","City"],["region","Province / region"],["postalCode","Postal code"]] as const).map(([key,label]) => <label key={key} className="block text-sm font-semibold text-slate-700">{label}<input required={!key.endsWith("2") && key !== "organisationName"} type={key === "email" ? "email" : "text"} value={registrant[key]} onChange={(e) => setRegistrant((current) => ({ ...current, [key]: e.target.value }))} className={inputClass} /></label>)}
              <label className="block text-sm font-semibold text-slate-700">Registration term<select value={termYears} onChange={(e) => setTermYears(Number(e.target.value))} className={inputClass}>{Array.from({length:10},(_,i)=><option key={i+1} value={i+1}>{i+1} {i===0?"year":"years"}</option>)}</select></label>
            </div>
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" required /><span>I confirm these details are accurate and consent to HEMBOX sending them to NameSilo OTE solely to test domain registration. This is a sandbox registration and is not a live domain purchase.</span></label>
            <button disabled={busy || !consent} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-teal px-5 text-sm font-black text-navy disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Create sandbox order <ArrowRight className="h-4 w-4" /></button>
          </form>
        </section> : null}

        {order && order.status !== "registered" ? <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <p className="text-xs font-bold uppercase tracking-wider text-teal">Step 3 · Sandbox checkout</p><h2 className="mt-1 text-xl font-black">{order.domain_name}</h2><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Term</p><p className="mt-1 font-bold">{order.term_years} year(s)</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">HEMBOX test payment</p><p className="mt-1 font-bold">K0.00 · Simulated</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Registrar</p><p className="mt-1 font-bold">NameSilo OTE</p></div></div>
          <p className="mt-4 text-sm leading-6 text-slate-600">Clicking below records a simulated test-payment event (no funds are collected by HEMBOX), then sends the registration request to NameSilo’s OTE account. NameSilo may consume sandbox test-account funds. The app verifies domain ownership and expiry with OTE before marking the domain registered.</p>
          <button onClick={registerOrder} disabled={busy || !["quoted"].includes(order.status)} className="mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-navy px-5 text-sm font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}Pay K0.00 in sandbox &amp; register</button>
          {order.status === "registration_unknown" || order.status === "registration_pending" ? <p className="mt-3 text-sm text-amber-800">Registration is awaiting reconciliation. Do not click register again; an administrator must check OTE account state.</p> : null}
        </section> : null}

        {order?.status === "registered" ? <section className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 sm:p-7"><div className="flex items-center gap-2 text-emerald-800"><CheckCircle2 className="h-5 w-5" /><p className="text-xs font-bold uppercase tracking-wider">Step 4 · Ownership confirmed</p></div><h2 className="mt-2 text-2xl font-black text-emerald-950">{order.domain_name}</h2><p className="mt-2 text-sm text-emerald-900">NameSilo OTE confirmed this domain is active in the sandbox account.</p><p className="mt-2 text-sm text-emerald-900">Expires: {formatDate(order.expires_at)}</p><Link href={`/domains/sandbox/${order.id}`} className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-800 px-4 text-sm font-bold text-white">Manage this domain <ArrowRight className="h-4 w-4" /></Link></section> : null}

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 sm:p-7"><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-teal">Your sandbox portfolio</p><h2 className="mt-1 text-xl font-black">Test domains</h2></div><button onClick={() => void loadOrders()} className="text-xs font-bold text-teal">Refresh</button></div>
          {loading ? <p className="mt-4 text-sm text-slate-500">Loading your test domains…</p> : orders.length === 0 ? <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No sandbox orders yet. Search a domain above to begin.</p> : <div className="mt-4 divide-y divide-slate-100">{orders.map((item) => <div key={item.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold">{item.domain_name}</p><p className="mt-1 text-xs text-slate-500">Status: {item.status.replaceAll("_"," ")} · {item.term_years} year(s) · Expires {formatDate(item.expires_at)}</p></div>{item.status === "registered" ? <Link href={`/domains/sandbox/${item.id}`} className="text-sm font-bold text-teal">Manage →</Link> : <span className="text-xs text-slate-500">Sandbox order</span>}</div>)}</div>}
        </section>
        <p className="mt-6 text-center text-xs leading-5 text-slate-400">Sandbox only. Test orders are stored separately from production orders and billing. They never create invoices or payment claims.</p>
      </main>
      <Footer />
    </div>
  )
}
