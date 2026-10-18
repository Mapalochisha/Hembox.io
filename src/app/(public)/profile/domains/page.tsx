"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { ArrowLeft, Globe2, Loader2, RefreshCw } from "lucide-react"
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
