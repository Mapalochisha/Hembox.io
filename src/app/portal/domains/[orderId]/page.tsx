"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react"
import { PortalShell } from "@/components/portal/portal-shell"

type Order = {
  id: string
  domain_name: string
  status: string
  expires_at: string | null
  registered_at: string | null
  nameservers: string[] | null
  nameservers_updated_at: string | null
  retail_currency: string
  renewal_retail_minor: number | null
}
type ManagementRequest = {
  id: string
  request_type: string
  requested_years: number | null
  requested_nameservers: string[] | null
  status: string
  customer_note: string | null
  admin_note: string | null
  created_at: string
  applied_at: string | null
}

function dateLabel(value: string | null) {
  if (!value) return "Not recorded"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleDateString()
}
function statusLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}
function money(minor: number | null, currency: string) {
  if (minor === null) return "Not available"
  try {
    return new Intl.NumberFormat("en-ZM", { style: "currency", currency: currency || "ZMW", maximumFractionDigits: 2 }).format(minor / 100)
  } catch {
    return (currency || "ZMW") + " " + (minor / 100).toFixed(2)
  }
}

export default function ManageDomainPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const [order, setOrder] = useState<Order | null>(null)
  const [requests, setRequests] = useState<ManagementRequest[]>([])
  const [years, setYears] = useState(1)
  const [nameservers, setNameservers] = useState("")
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const load = useCallback(async () => {
    const response = await fetch("/api/domains/management?orderId=" + encodeURIComponent(orderId), { cache: "no-store" })
    const body = await response.json()
    if (!response.ok) throw new Error(body.error ?? "Domain management is unavailable.")
    setOrder(body.order)
    setRequests(body.requests ?? [])
    setNameservers(body.order.nameservers?.join("\n") ?? "")
  }, [orderId])

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Could not load domain.")).finally(() => setLoading(false))
  }, [load])

  async function refresh() {
    setLoading(true)
    setError("")
    try {
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed.")
    } finally {
      setLoading(false)
    }
  }

  async function submit(requestType: "renewal" | "nameservers") {
    setBusy(true)
    setError("")
    setNotice("")
    try {
      const response = await fetch("/api/domains/management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          requestType,
          ...(requestType === "renewal"
            ? { requestedYears: years }
            : { requestedNameservers: nameservers.split(/[\n,]+/).map((value) => value.trim()).filter(Boolean) }),
          customerNote: note,
          idempotencyKey: crypto.randomUUID(),
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? "Could not submit management request.")
      setNotice("Your request has been sent to HEMBOX for review. The domain has not been changed yet.")
      setNote("")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit request.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <PortalShell title="Manage domain">
      <main className="mx-auto max-w-5xl px-0 pb-10">
        <Link href="/portal/domains" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-teal">
          <ArrowLeft className="h-4 w-4" /> Back to My domains
        </Link>
        <header className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal">Domain management</p>
            <h1 className="mt-2 break-all text-3xl font-black tracking-tight text-navy">{order?.domain_name ?? "Manage domain"}</h1>
            <p className="mt-2 text-sm text-slate-500">Review domain details and submit renewal or nameserver requests.</p>
          </div>
          <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex h-10 items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold disabled:opacity-50">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </header>

        {error ? <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
        {notice ? <p role="status" className="mt-5 rounded-xl border border-teal/30 bg-teal/5 p-3 text-sm text-navy">{notice}</p> : null}
        {loading ? <div className="mt-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-teal" /></div> : null}

        {!loading && order ? (
          <>
            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Domain status</p><p className="mt-1 text-lg font-black text-navy">{statusLabel(order.status)}</p></div>
                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">Registration confirmed</span>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Registered" value={dateLabel(order.registered_at)} />
                <Metric label="Expiry date" value={dateLabel(order.expires_at)} />
                <Metric label="Renewal per year" value={money(order.renewal_retail_minor, order.retail_currency)} />
                <Metric label="Nameservers last updated" value={dateLabel(order.nameservers_updated_at)} />
              </div>
              <div className="mt-4 rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-500">Current nameservers</p>
                {order.nameservers?.length ? (
                  <ul className="mt-2 space-y-1 text-sm font-semibold text-navy">{order.nameservers.map((server) => <li key={server} className="break-all">{server}</li>)}</ul>
                ) : <p className="mt-2 text-sm text-slate-500">No nameserver information has been recorded.</p>}
              </div>
            </section>

            {order.status === "registered" ? (
              <section className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h2 className="text-lg font-black text-navy">Request a renewal</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">Choose the renewal term. HEMBOX will review the request and confirm the payable amount before any renewal is processed.</p>
                  <label className="mt-4 block text-sm font-semibold text-slate-700">Renewal term
                    <select value={years} onChange={(event) => setYears(Number(event.target.value))} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3">
                      {Array.from({ length: 10 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} year{index === 0 ? "" : "s"}</option>)}
                    </select>
                  </label>
                  <button type="button" onClick={() => void submit("renewal")} disabled={busy} className="mt-4 h-11 w-full rounded-xl bg-navy text-sm font-bold text-white disabled:opacity-50">{busy ? "Submitting…" : "Request renewal"}</button>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h2 className="text-lg font-black text-navy">Change nameservers</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">Enter 2–8 unique nameserver hostnames, one per line. HEMBOX will review the request; it is not applied automatically.</p>
                  <textarea value={nameservers} onChange={(event) => setNameservers(event.target.value)} rows={4} placeholder={"ns1.example.com\nns2.example.com"} className="mt-4 w-full rounded-xl border border-slate-200 p-3 text-sm" />
                  <button type="button" onClick={() => void submit("nameservers")} disabled={busy} className="mt-4 h-11 w-full rounded-xl border border-slate-200 text-sm font-bold text-navy disabled:opacity-50">{busy ? "Submitting…" : "Request nameserver change"}</button>
                </div>
              </section>
            ) : (
              <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">This domain is not in a registered state, so post-registration management is unavailable.</p>
            )}

            {order.status === "registered" ? (
              <label className="mt-4 block rounded-2xl border border-slate-200 bg-white p-5 text-sm font-semibold text-navy">
                Note for HEMBOX (optional)
                <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={500} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal" placeholder="Add instructions or context for your request…" />
              </label>
            ) : null}

            <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-black text-navy">Request activity</h2>
                <span className="text-xs font-semibold text-slate-500">{requests.length} recent request{requests.length === 1 ? "" : "s"}</span>
              </div>
              {requests.length === 0 ? <p className="mt-3 text-sm text-slate-500">There are no management requests for this domain yet.</p> : (
                <ol className="mt-4 divide-y divide-slate-100">
                  {requests.map((item) => (
                    <li key={item.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-bold capitalize text-navy">{item.request_type === "nameservers" ? "Nameserver change" : "Renewal"} request</p>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{statusLabel(item.status)}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">Submitted {new Date(item.created_at).toLocaleString()}{item.applied_at ? " · Applied " + new Date(item.applied_at).toLocaleString() : ""}</p>
                      <p className="mt-2 text-sm text-slate-600">{item.request_type === "renewal" ? "Requested term: " + item.requested_years + " year(s)" : "Requested nameservers: " + (item.requested_nameservers?.join(", ") ?? "Not recorded")}</p>
                      {item.customer_note ? <p className="mt-2 text-sm text-slate-600">Your note: {item.customer_note}</p> : null}
                      {item.admin_note ? <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">HEMBOX update: {item.admin_note}</p> : null}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        ) : null}
      </main>
    </PortalShell>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 text-sm font-bold text-navy">{value}</p></div>
}
