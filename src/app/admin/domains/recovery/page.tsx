"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, RefreshCw, ShieldAlert } from "lucide-react"

type Item = {
  orderId: string
  domainName: string
  orderStatus: string
  updatedAt: string
  quote: null | { expiresAt: string; registrationPriceMinor: number; renewalPriceMinor: number; currency: string }
  payment: null | { provider: string; status: string; amountMinor: number; currency: string; lastCheckedAt: string | null }
  billing: {
    invoice: null | { id: string; number: string; status: string; currency: string; totalMinor: number; paidAt: string | null }
    allocatedMinor: number
    outstandingMinor: number | null
    pendingClaimCount: number
    legacyClaimCount: number
    registrantPresent: boolean
  }
  reconciliation: { severity: "clear" | "warning" | "critical"; issues: string[] }
  webhookEvents: Array<{ eventId: string; eventType: string; signatureVerified: boolean; processingStatus: string; safeErrorCode: string | null; receivedAt: string; processedAt: string | null }>
  registration: { provider: string | null; providerOrderReference: string | null; registeredAt: string | null }
  recommendedAction: string
}

const label = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
const money = (minor: number, currency: string) => new Intl.NumberFormat("en-ZM", { style: "currency", currency, maximumFractionDigits: 2 }).format(minor / 100)
const when = (value: string | null) => value ? new Date(value).toLocaleString() : "Not recorded"

function Severity({ value }: { value: Item["reconciliation"]["severity"] }) {
  const classes = value === "critical" ? "bg-rose-50 text-rose-800 border-rose-200"
    : value === "warning" ? "bg-amber-50 text-amber-800 border-amber-200"
      : "bg-emerald-50 text-emerald-800 border-emerald-200"
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${classes}`}>{label(value)}</span>
}

export default function AdminDomainRecoveryPage() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const refresh = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/admin/domains/recovery", { cache: "no-store" })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to load reconciliation.")
      setItems(result.items ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load reconciliation.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const counts = useMemo(() => ({
    critical: items.filter((item) => item.reconciliation.severity === "critical").length,
    warning: items.filter((item) => item.reconciliation.severity === "warning").length,
    clear: items.filter((item) => item.reconciliation.severity === "clear").length,
  }), [items])

  return <div className="space-y-8">
    <div>
      <Link href="/admin/domains/orders" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-teal"><ArrowLeft className="h-4 w-4" /> Domain order queue</Link>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-teal">Operations · M8</p><h1 className="mt-2 text-3xl font-black tracking-tight text-navy">Recovery & reconciliation</h1><p className="mt-2 max-w-3xl text-sm text-slate-600">Read-only comparison of domain orders, unified billing invoices, payment allocations, registrant capture and registrar evidence.</p></div>
        <button onClick={() => void refresh()} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold disabled:opacity-50"><RefreshCw className="h-4 w-4" /> Refresh</button>
      </div>
    </div>
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>Safety rule:</strong> this screen is diagnostic only. It cannot mark invoices paid, allocate or reverse funds, approve claims, refund money, retry registration or change order status. Registrant contact details are never displayed here.</div>
    {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p> : null}
    {loading ? <div className="flex h-40 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-teal" /></div> : null}
    {!loading && !error ? <>
      <div className="grid gap-4 sm:grid-cols-3">
        <section className="rounded-2xl border border-rose-200 bg-white p-5"><ShieldAlert className="h-5 w-5 text-rose-600" /><p className="mt-3 text-sm text-slate-500">Critical mismatches</p><p className="mt-1 text-3xl font-black text-navy">{counts.critical}</p></section>
        <section className="rounded-2xl border border-amber-200 bg-white p-5"><AlertTriangle className="h-5 w-5 text-amber-600" /><p className="mt-3 text-sm text-slate-500">Warnings</p><p className="mt-1 text-3xl font-black text-navy">{counts.warning}</p></section>
        <section className="rounded-2xl border border-emerald-200 bg-white p-5"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><p className="mt-3 text-sm text-slate-500">Reconciled orders</p><p className="mt-1 text-3xl font-black text-navy">{counts.clear}</p></section>
      </div>
      {items.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">No domain orders found. The reconciliation queue is ready for the first order.</div> : <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[1750px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>
            <th className="px-4 py-3">Domain / order</th><th className="px-4 py-3">Order state</th><th className="px-4 py-3">Quote</th><th className="px-4 py-3">Billing ledger</th><th className="px-4 py-3">Registrant</th><th className="px-4 py-3">Provider payment</th><th className="px-4 py-3">Webhook ledger</th><th className="px-4 py-3">Registration</th><th className="px-4 py-3">Reconciliation</th><th className="px-4 py-3">Suggested action</th>
          </tr></thead>
          <tbody>{items.map((item) => <tr key={item.orderId} className="border-b border-slate-100 align-top last:border-0">
            <td className="px-4 py-4"><p className="font-bold text-navy">{item.domainName}</p><p className="mt-1 text-xs text-slate-500">{item.orderId}</p><p className="mt-1 text-xs text-slate-500">Updated {when(item.updatedAt)}</p></td>
            <td className="px-4 py-4">{label(item.orderStatus)}</td>
            <td className="px-4 py-4">{item.quote ? <><p>{money(item.quote.registrationPriceMinor, item.quote.currency)} registration</p><p className="mt-1 text-xs text-slate-500">{money(item.quote.renewalPriceMinor, item.quote.currency)} renewal</p><p className="mt-1 text-xs text-slate-500">Expires {when(item.quote.expiresAt)}</p></> : "No saved quote"}</td>
            <td className="px-4 py-4">{item.billing.invoice ? <><p className="font-semibold text-navy">{item.billing.invoice.number}</p><p className="mt-1">{label(item.billing.invoice.status)} · {money(item.billing.invoice.totalMinor, item.billing.invoice.currency)}</p><p className="mt-1 text-xs text-slate-500">Allocated {money(item.billing.allocatedMinor, item.billing.invoice.currency)}</p><p className="mt-1 text-xs text-slate-500">Outstanding {money(item.billing.outstandingMinor ?? 0, item.billing.invoice.currency)}</p><p className="mt-1 text-xs text-slate-500">{item.billing.pendingClaimCount} pending claim(s)</p></> : <span className="text-rose-700">No linked invoice</span>}</td>
            <td className="px-4 py-4">{item.billing.registrantPresent ? <span className="font-semibold text-emerald-700">Captured</span> : <span className="font-semibold text-amber-700">Missing</span>}{item.billing.legacyClaimCount > 0 ? <p className="mt-2 text-xs text-amber-700">{item.billing.legacyClaimCount} legacy claim(s)</p> : null}</td>
            <td className="px-4 py-4">{item.payment ? <><p>{label(item.payment.status)}</p><p className="mt-1 text-xs text-slate-500">{money(item.payment.amountMinor, item.payment.currency)} · {item.payment.provider}</p><p className="mt-1 text-xs text-slate-500">Checked {when(item.payment.lastCheckedAt)}</p></> : <span className="text-xs text-slate-500">No provider payment attempt</span>}</td>
            <td className="px-4 py-4">{item.webhookEvents?.length ? <div className="space-y-3">{item.webhookEvents.map((event) => <div key={event.eventId} className="max-w-[240px] border-b border-slate-100 pb-2 last:border-0"><p className="font-semibold text-navy">{label(event.processingStatus)}</p><p className="mt-1 text-xs text-slate-600">{event.eventType}</p><p className={`mt-1 text-xs ${event.signatureVerified ? "text-emerald-700" : "text-rose-700"}`}>{event.signatureVerified ? "Signature verified" : "Signature not verified"}</p>{event.safeErrorCode ? <p className="mt-1 text-xs text-rose-700">Error: {event.safeErrorCode}</p> : null}<p className="mt-1 text-[11px] text-slate-500">Received {when(event.receivedAt)}</p></div>)}</div> : <span className="text-xs text-slate-500">No linked webhook events</span>}</td>
            <td className="px-4 py-4 text-xs text-slate-600"><p>{item.registration.provider || "No provider"}</p><p className="mt-1 break-all">{item.registration.providerOrderReference || "No registrar reference"}</p><p className="mt-1">Registered {when(item.registration.registeredAt)}</p></td>
            <td className="px-4 py-4"><Severity value={item.reconciliation.severity} />{item.reconciliation.issues.length ? <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-600">{item.reconciliation.issues.map((issue) => <li key={issue}>{label(issue)}</li>)}</ul> : <p className="mt-2 text-xs text-emerald-700">No ledger mismatches detected.</p>}</td>
            <td className="px-4 py-4"><p className="font-semibold text-navy">{label(item.recommendedAction)}</p><p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">Guidance only. Verify source records and audit any manual action.</p></td>
          </tr>)}</tbody>
        </table>
      </div>}
    </> : null}
  </div>
}
