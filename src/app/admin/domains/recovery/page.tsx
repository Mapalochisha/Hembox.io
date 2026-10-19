"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react"

type Item = {
  orderId: string
  domainName: string
  orderStatus: string
  updatedAt: string
  quote: null | { expiresAt: string; registrationPriceMinor: number; renewalPriceMinor: number; currency: string }
  payment: null | { provider: string; status: string; amountMinor: number; currency: string; lastCheckedAt: string | null }
  registration: { provider: string | null; providerOrderReference: string | null; registeredAt: string | null }
  recommendedAction: string
}

const label = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
const money = (minor: number, currency: string) => new Intl.NumberFormat("en-ZM", { style: "currency", currency, maximumFractionDigits: 2 }).format(minor / 100)
const when = (value: string | null) => value ? new Date(value).toLocaleString() : "Not recorded"

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
      if (!response.ok) throw new Error(result.error || "Unable to load recovery queue.")
      setItems(result.items ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load recovery queue.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  return <div className="space-y-8">
    <div>
      <Link href="/admin/domains/orders" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-teal"><ArrowLeft className="h-4 w-4" /> Domain order queue</Link>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-teal">Operations</p><h1 className="mt-2 text-3xl font-black tracking-tight text-navy">Recovery & reconciliation</h1><p className="mt-2 max-w-3xl text-sm text-slate-600">Read-only guidance based on saved order, quote and payment records. Recommendations never execute actions.</p></div>
        <button onClick={() => void refresh()} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold disabled:opacity-50"><RefreshCw className="h-4 w-4" /> Refresh</button>
      </div>
    </div>
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>Safety rule:</strong> reconcile ambiguous registrar outcomes before retrying. This screen cannot mark orders paid, refund money, retry registration, or change statuses.</div>
    {error ? <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</p> : null}
    {loading ? <div className="flex h-40 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-teal" /></div> : null}
    {!loading && !error && items.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">No domain orders found.</div> : null}
    {!loading && !error && items.length > 0 ? <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full min-w-[1000px] text-left text-sm">
      <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Domain / order</th><th className="px-4 py-3">Order state</th><th className="px-4 py-3">Quote</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Registration</th><th className="px-4 py-3">Suggested next step</th></tr></thead>
      <tbody>{items.map((item) => <tr key={item.orderId} className="border-b border-slate-100 align-top last:border-0">
        <td className="px-4 py-4"><p className="font-bold text-navy">{item.domainName}</p><p className="mt-1 text-xs text-slate-500">{item.orderId}</p><p className="mt-1 text-xs text-slate-500">Updated {when(item.updatedAt)}</p></td>
        <td className="px-4 py-4">{label(item.orderStatus)}</td>
        <td className="px-4 py-4">{item.quote ? <><p>{money(item.quote.registrationPriceMinor, item.quote.currency)} registration</p><p className="mt-1 text-xs text-slate-500">{money(item.quote.renewalPriceMinor, item.quote.currency)} renewal</p><p className="mt-1 text-xs text-slate-500">Expires {when(item.quote.expiresAt)}</p></> : "No saved quote"}</td>
        <td className="px-4 py-4">{item.payment ? <><p>{label(item.payment.status)}</p><p className="mt-1 text-xs text-slate-500">{money(item.payment.amountMinor, item.payment.currency)} · {item.payment.provider}</p><p className="mt-1 text-xs text-slate-500">Checked {when(item.payment.lastCheckedAt)}</p></> : "No payment attempt"}</td>
        <td className="px-4 py-4 text-xs text-slate-600"><p>{item.registration.provider || "No provider"}</p><p className="mt-1 break-all">{item.registration.providerOrderReference || "No registrar reference"}</p><p className="mt-1">Registered {when(item.registration.registeredAt)}</p></td>
        <td className="px-4 py-4"><p className="font-semibold text-navy">{label(item.recommendedAction)}</p><p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">Guidance only. Verify records and audit any manual action.</p></td>
      </tr>)}</tbody>
    </table></div> : null}
  </div>
}
