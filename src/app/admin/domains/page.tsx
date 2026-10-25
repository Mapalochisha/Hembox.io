"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, RefreshCw, Save } from "lucide-react"

type CatalogRow = {
  tld: string
  provider_id: string
  wholesale_currency: string
  registration_wholesale_minor: number | null
  renewal_wholesale_minor: number | null
  wholesale_fx_rate_micros: number | null
  margin_basis_points: number | null
  pricing_source: string | null
  retail_currency: string
  registration_retail_minor: number | null
  renewal_retail_minor: number | null
  price_updated_at: string | null
  enabled: boolean
}

const emptyForm = {
  tld: ".com",
  providerId: "namesilo",
  wholesaleCurrency: "USD",
  registrationWholesaleMinor: "",
  renewalWholesaleMinor: "",
  fxRateMicros: "",
  marginBasisPoints: "2000",
  pricingSource: "",
  enabled: false,
}

function money(minor: number | null, currency = "ZMW") {
  if (minor === null) return "Not set"
  return new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(minor / 100)
}

export default function AdminDomainsPage() {
  const [catalog, setCatalog] = useState<CatalogRow[]>([])
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")

  const loadCatalog = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/admin/domains/catalog", { cache: "no-store" })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to load domain catalogue.")
      setCatalog(result.catalog ?? [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load domain catalogue.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadCatalog() }, [loadCatalog])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError("")
    setNotice("")
    try {
      const response = await fetch("/api/admin/domains/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          registrationWholesaleMinor: Number(form.registrationWholesaleMinor),
          renewalWholesaleMinor: Number(form.renewalWholesaleMinor),
          fxRateMicros: Number(form.fxRateMicros),
          marginBasisPoints: Number(form.marginBasisPoints),
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to save domain pricing.")
      setNotice(`Saved ${result.catalog.tld}. Retail prices were calculated and a price-history snapshot was recorded.`)
      setForm(emptyForm)
      await loadCatalog()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save domain pricing.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal">Domain reselling</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-navy">TLD catalogue & pricing</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Enter costs and FX inputs only after verifying them from a documented source. Retail prices are calculated server-side in ZMW.
          </p>
        </div>
        <button onClick={() => void loadCatalog()} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-navy">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        <strong>Sales safety:</strong> Do not enable a TLD until its wholesale registration and renewal costs, FX rate, and source note are verified. A current price is not proof of domain availability. The provider connection, checkout, payment, and registration are still disabled.
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-lg font-bold text-navy">Add or update a TLD</h2>
        <form onSubmit={handleSubmit} className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="TLD" value={form.tld} onChange={(tld) => setForm({ ...form, tld })} placeholder=".com" />
          <Field label="Provider ID" value={form.providerId} onChange={(providerId) => setForm({ ...form, providerId })} placeholder="namesilo" />
          <Field label="Wholesale currency" value={form.wholesaleCurrency} onChange={(wholesaleCurrency) => setForm({ ...form, wholesaleCurrency: wholesaleCurrency.toUpperCase() })} placeholder="USD" />
          <Field label="Registration cost (minor units)" type="number" value={form.registrationWholesaleMinor} onChange={(registrationWholesaleMinor) => setForm({ ...form, registrationWholesaleMinor })} placeholder="Verified cost in minor units" />
          <Field label="Renewal cost (minor units)" type="number" value={form.renewalWholesaleMinor} onChange={(renewalWholesaleMinor) => setForm({ ...form, renewalWholesaleMinor })} placeholder="Verified cost in minor units" />
          <Field label="FX rate × 1,000,000" type="number" value={form.fxRateMicros} onChange={(fxRateMicros) => setForm({ ...form, fxRateMicros })} placeholder="e.g. 25000000 means 25.0" />
          <Field label="Markup (basis points)" type="number" value={form.marginBasisPoints} onChange={(marginBasisPoints) => setForm({ ...form, marginBasisPoints })} placeholder="2000 means 20%" />
          <Field label="Pricing source / verification note" value={form.pricingSource} onChange={(pricingSource) => setForm({ ...form, pricingSource })} placeholder="Source and verification date" />
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-semibold text-slate-700 sm:col-span-2">
            <input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} className="h-4 w-4 accent-teal" />
            Enable this TLD in the public price catalogue
          </label>
          <p className="text-xs leading-5 text-slate-500 sm:col-span-2">
            Monetary inputs use minor units (for example, USD cents). FX is ZMW minor units per wholesale-currency minor unit, scaled by 1,000,000. Retail prices round up to the next K1.
          </p>
          <button type="submit" disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-navy px-5 text-sm font-bold text-white disabled:opacity-60 sm:col-span-2 sm:justify-self-start">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving pricing…" : "Save pricing inputs"}
          </button>
        </form>
        {error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {notice ? <p role="status" className="mt-4 rounded-xl bg-teal/10 p-3 text-sm text-teal-900">{notice}</p> : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-lg font-bold text-navy">Configured TLDs</h2>
        {loading ? (
          <div className="flex h-28 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-teal" /></div>
        ) : catalog.length === 0 ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No TLDs configured yet. Nothing is published until verified pricing is saved.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-3 py-3">TLD</th><th className="px-3 py-3">Provider</th><th className="px-3 py-3">Registration</th><th className="px-3 py-3">Renewal</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Price snapshot</th></tr>
              </thead>
              <tbody>
                {catalog.map((row) => (
                  <tr key={row.tld} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-4 font-bold text-navy">{row.tld}</td>
                    <td className="px-3 py-4">{row.provider_id}</td>
                    <td className="px-3 py-4">{money(row.registration_retail_minor)}</td>
                    <td className="px-3 py-4">{money(row.renewal_retail_minor)}</td>
                    <td className="px-3 py-4"><span className={row.enabled ? "rounded-full bg-teal/10 px-2.5 py-1 text-xs font-bold text-teal-800" : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600"}>{row.enabled ? "Enabled" : "Disabled"}</span></td>
                    <td className="px-3 py-4 text-xs text-slate-500">{row.price_updated_at ? new Date(row.price_updated_at).toLocaleString() : "Not set"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function Field({
  label, value, onChange, placeholder, type = "text",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  return (
    <label htmlFor={id} className="block text-sm font-semibold text-slate-700">
      {label}
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? "1" : undefined}
        className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none transition focus:border-teal focus:ring-4 focus:ring-teal/10"
      />
    </label>
  )
}
