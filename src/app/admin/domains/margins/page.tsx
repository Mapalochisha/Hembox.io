"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { ArrowLeft, Loader2, RefreshCw, TrendingDown, TrendingUp } from "lucide-react"

type MarginBucket = {
  retailMinor: number
  wholesaleZmwMinor: number
  grossMarginMinor: number
}

type Report = {
  generatedAt: string
  scope: string
  sampleLimit: number
  sampledQuotes: number
  hasMorePotentialRecords: boolean
  completeSnapshots: number
  incompleteSnapshots: number
  quotes: { expired: number; unexpired: number }
  currency: string
  estimates: {
    registration: MarginBucket
    renewal: MarginBucket
    combinedGrossMarginMinor: number
  }
  note: string
}

function money(minor: number, currency = "ZMW") {
  return new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(minor / 100)
}

function Metric({ label, value, detail, negative = false }: {
  label: string
  value: string
  detail: string
  negative?: boolean
}) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <p className="text-sm font-semibold text-slate-500">{label}</p>
    <p className={`mt-2 text-2xl font-black tracking-tight ${negative ? "text-rose-700" : "text-navy"}`}>{value}</p>
    <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
  </div>
}

export default function AdminDomainMarginsPage() {
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const refresh = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/admin/domains/margins", { cache: "no-store" })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to load margin report.")
      setReport(result as Report)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load margin report.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const combined = report?.estimates.combinedGrossMarginMinor ?? 0
  const negative = combined < 0

  return <div className="space-y-8">
    <div>
      <Link href="/admin/domains" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-teal"><ArrowLeft className="h-4 w-4" /> TLD catalogue & pricing</Link>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal">Domain reselling</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-navy">Quote margin report</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Indicative margin estimates calculated from the immutable wholesale, FX and retail inputs saved with recent quotes.</p>
        </div>
        <button onClick={() => void refresh()} disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-navy disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh report
        </button>
      </div>
    </div>

    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
      <strong>Not accounting profit:</strong> these figures exclude payment fees, taxes, refunds, chargebacks, post-quote FX movement and operating costs. They represent saved quote snapshots, not completed sales or collected revenue. No registrar or payment action is performed here.
    </div>

    {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p> : null}
    {loading && !report ? <div className="flex h-40 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-teal" /></div> : null}

    {!loading && !error && report ? <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Quotes sampled" value={String(report.sampledQuotes)} detail={report.hasMorePotentialRecords ? `Latest ${report.sampleLimit} records; more may exist.` : "All currently returned quote records."} />
        <Metric label="Complete cost snapshots" value={String(report.completeSnapshots)} detail={`${report.incompleteSnapshots} missing or invalid cost snapshots excluded.`} />
        <Metric label="Expired quotes" value={String(report.quotes.expired)} detail={`${report.quotes.unexpired} quotes not yet expired at report time.`} />
        <Metric label="Combined estimated margin" value={money(combined)} detail="Registration plus renewal estimate across complete sampled quotes." negative={negative} />
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5 sm:p-6">
          <h2 className="text-lg font-bold text-navy">Margin by quote component</h2>
          <p className="mt-1 text-sm text-slate-500">Wholesale costs are converted with the FX rate captured on each quote.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-5 py-3">Component</th><th className="px-5 py-3">Retail total</th><th className="px-5 py-3">Converted wholesale</th><th className="px-5 py-3">Estimated gross margin</th></tr>
            </thead>
            <tbody>
              {(["registration", "renewal"] as const).map((key) => {
                const bucket = report.estimates[key]
                return <tr key={key} className="border-b border-slate-100 last:border-0">
                  <td className="px-5 py-4 font-semibold capitalize text-navy">{key}</td>
                  <td className="px-5 py-4">{money(bucket.retailMinor)}</td>
                  <td className="px-5 py-4">{money(bucket.wholesaleZmwMinor)}</td>
                  <td className={`px-5 py-4 font-bold ${bucket.grossMarginMinor < 0 ? "text-rose-700" : "text-navy"}`}>{money(bucket.grossMarginMinor)}</td>
                </tr>
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${negative ? "border-rose-200 bg-rose-50 text-rose-900" : "border-slate-200 bg-white text-slate-700"}`}>
        {negative ? <TrendingDown className="mt-0.5 h-5 w-5 shrink-0" /> : <TrendingUp className="mt-0.5 h-5 w-5 shrink-0" />}
        <div>
          <p className="font-bold">{negative ? "Negative estimated margin in this sample" : "Estimated margin is positive for this sample"}</p>
          <p className="mt-1 leading-6">Review the underlying verified cost source, FX inputs and markup before enabling any TLD. This report is limited to the latest saved quote snapshots and is not a forecast or realized profit statement.</p>
        </div>
      </div>

      <p className="text-xs text-slate-500">Generated {new Date(report.generatedAt).toLocaleString()} · <Link href="/admin/domains/recovery" className="font-semibold text-teal hover:underline">Open recovery & reconciliation</Link> · <Link href="/admin/domains/orders" className="font-semibold text-teal hover:underline">Open domain orders</Link></p>
      <p className="text-xs leading-5 text-slate-500">{report.note}</p>
    </> : null}
  </div>
}
