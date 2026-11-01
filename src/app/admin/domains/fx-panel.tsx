"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, RefreshCw } from "lucide-react"

type Snapshot = {
  published_rate: number
  buffer_zmw: number
  effective_rate: number
  rate_date: string
  retrieved_at: string
  official_source_url: string
  retrieval_source_url: string
}
type Props = { onRateMicros?: (value: number) => void }

export default function DomainFxPanel({ onRateMicros }: Props) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/domains/fx", { cache: "no-store" })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Unable to load FX reference.")
      const value = body.snapshot as Snapshot | null
      setSnapshot(value)
      if (value) onRateMicros?.(Math.round(value.effective_rate * 1_000_000))
      setError("")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load FX reference.")
    } finally {
      setLoading(false)
    }
  }, [onRateMicros])

  useEffect(() => { void load() }, [load])

  async function refresh() {
    setRefreshing(true)
    setError("")
    try {
      const response = await fetch("/api/admin/domains/fx", { method: "POST" })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "FX refresh failed.")
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "FX refresh failed.")
    } finally {
      setRefreshing(false)
    }
  }

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal">Official FX reference</p>
        <h2 className="mt-1 text-lg font-bold text-navy">Bank of Zambia · USD/ZMW</h2>
        <p className="mt-1 text-sm text-slate-600">Daily published middle rate plus the HEMBOX K1.00/USD buffer. USD domain catalogue entries are repriced automatically; TLD enablement is never changed.</p>
      </div>
      <button onClick={() => void refresh()} disabled={refreshing || loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-navy px-4 text-sm font-bold text-white disabled:opacity-50">
        {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        {refreshing ? "Refreshing…" : "Refresh FX now"}
      </button>
    </div>
    {error ? <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
    {loading ? <p className="mt-4 text-sm text-slate-500">Loading latest saved rate…</p> : snapshot ? (
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Metric label="BoZ middle rate" value={`K${snapshot.published_rate.toFixed(4)}`} />
        <Metric label="HEMBOX buffer" value={`+K${snapshot.buffer_zmw.toFixed(2)}`} />
        <Metric label="Effective pricing rate" value={`K${snapshot.effective_rate.toFixed(4)}`} />
        <Metric label="Publication date" value={snapshot.rate_date} />
        <p className="text-xs text-slate-500 sm:col-span-4">Retrieved {new Date(snapshot.retrieved_at).toLocaleString()} · <a className="underline" href={snapshot.official_source_url} target="_blank" rel="noreferrer">Bank of Zambia source</a> · machine-readable feed: <a className="underline" href={snapshot.retrieval_source_url} target="_blank" rel="noreferrer">rate feed</a></p>
      </div>
    ) : <p className="mt-4 text-sm text-slate-500">No FX rate has been saved yet. Refresh to retrieve the latest published BoZ rate.</p>}
  </section>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3">
    <p className="text-xs text-slate-500">{label}</p>
    <p className="mt-1 text-lg font-black text-navy">{value}</p>
  </div>
}
