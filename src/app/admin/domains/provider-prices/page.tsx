"use client"

import Link from "next/link"
import { useState } from "react"
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react"

type Price = { tld: string; registrationUsdMinor: number; renewalUsdMinor: number }
type Result = { fetchedAt: string; source: string; environment?: "test" | "live"; prices: Price[]; message: string }

function usd(minor: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(minor / 100)
}

/**
 * Hands a retrieved provider rate to the catalogue form. The link carries only
 * the provider values plus provenance; it cannot enable a TLD or supply an FX
 * rate or markup, and the catalogue page validates every field again.
 */
function catalogueHref(price: Price, environment: "test" | "live" | undefined, fetchedAt: string) {
  const search = new URLSearchParams({
    tld: `.${price.tld.replace(/^\.+/, "")}`,
    provider: "namesilo",
    currency: "USD",
    environment: environment ?? "",
    fetchedAt,
    registrationWholesaleMinor: String(price.registrationUsdMinor),
    renewalWholesaleMinor: String(price.renewalUsdMinor),
  })
  return `/admin/domains?${search.toString()}`
}

export default function DomainProviderPricesPage() {
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function refresh() {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/admin/domains/provider-prices", { cache: "no-store" })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Unable to retrieve provider prices.")
      setResult(body as Result)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to retrieve provider prices.")
    } finally {
      setLoading(false)
    }
  }

  return <div className="space-y-7">
    <div>
      <Link href="/admin/domains" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-teal"><ArrowLeft className="h-4 w-4" /> TLD catalogue & pricing</Link>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal">Domain reselling · NameSilo</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-navy">Wholesale price reference</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Retrieve the standard pay-as-you-go registration and renewal schedule from the NameSilo environment selected by <code className="rounded bg-slate-100 px-1">DOMAIN_PROVIDER_MODE</code> (sandbox or production). This is a read-only reference, not an automatic catalogue update.</p>
        </div>
        <button onClick={() => void refresh()} disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-navy px-4 text-sm font-bold text-white disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {result ? "Refresh rates" : "Retrieve rates"}
        </button>
      </div>
    </div>

    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
      <strong>Review required:</strong> provider rates are USD cents. Before publishing a ZMW price, verify and record a current USD/ZMW rate, its source and observation time, and the approved Hembox markup. Registration and renewal are separate costs. No TLD is enabled by this retrieval.
    </div>
    {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p> : null}
    {result ? <>
      {result.environment === "test" ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-950">
          <strong>Sandbox (OTE) rates.</strong> These come from NameSilo&apos;s sandbox account and are not production prices. Use them to rehearse the FX and markup flow; repeat this retrieval against the production account before approving any customer price. No TLD is enabled by this retrieval.
        </div>
      ) : null}
      <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        <span><strong className="text-navy">Source:</strong> NameSilo standard retail schedule</span>
        <span><strong className="text-navy">Environment:</strong> {result.environment === "test" ? "OTE sandbox" : result.environment === "live" ? "Production" : "Unknown"}</span>
        <span><strong className="text-navy">Fetched:</strong> {new Date(result.fetchedAt).toLocaleString()}</span>
        <span><strong className="text-navy">TLDs:</strong> {result.prices.length}</span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">TLD</th><th className="px-5 py-3">Registration</th><th className="px-5 py-3">Renewal</th><th className="px-5 py-3">Catalogue</th></tr></thead>
            <tbody>{result.prices.map((price) => <tr key={price.tld} className="border-b border-slate-100 last:border-0"><td className="px-5 py-4 font-bold text-navy">.{price.tld}</td><td className="px-5 py-4">{usd(price.registrationUsdMinor)}</td><td className="px-5 py-4">{usd(price.renewalUsdMinor)}</td><td className="px-5 py-4"><Link href={catalogueHref(price, result.environment, result.fetchedAt)} className="font-semibold text-teal underline decoration-teal/40 underline-offset-2 hover:text-teal-800">Use in catalogue</Link></td></tr>)}</tbody>
          </table>
        </div>
      </div>
      <p className="text-xs leading-5 text-slate-500">{result.message} Rates may change; retrieve them again before approving or issuing a customer quote.</p>
      <p className="text-xs leading-5 text-slate-500"><strong className="text-navy">Use in catalogue</strong> copies the retrieved cost and its provenance into the catalogue form on this browser. It saves nothing, enables nothing, and deliberately leaves FX and markup for you to enter after approval.</p>
    </> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">No provider price response loaded yet. Retrieve rates when the live NameSilo API key is configured.</div>}
  </div>
}
