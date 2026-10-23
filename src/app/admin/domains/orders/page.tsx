"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import type { FormEvent } from "react"
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react"

const statuses = ["all", "enquiry", "quoted", "awaiting_payment", "payment_confirmed", "registration_pending", "registered", "registration_failed", "cancelled", "refunded", "manual_review"] as const

type DomainOrder = {
  id: string; customer_email: string; customer_name: string | null; domain_name: string; status: string
  retail_currency: string; registration_retail_minor: number | null; renewal_retail_minor: number | null
  provider_id: string | null; provider_order_reference: string | null; created_at: string
}
type AuditEvent = { id: string; order_id: string | null; event_type: string; created_at: string; actor_user_id: string | null }

function money(minor: number | null, currency: string) {
  if (minor === null) return "Not quoted"
  return new Intl.NumberFormat("en-ZM", { style: "currency", currency: currency || "ZMW", maximumFractionDigits: 2 }).format(minor / 100)
}
function title(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) }

export default function AdminDomainOrdersPage() {
  const [status, setStatus] = useState<(typeof statuses)[number]>("all")
  const [orders, setOrders] = useState<DomainOrder[]>([])
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [fulfillOrderId, setFulfillOrderId] = useState("")
  const [fulfillBusy, setFulfillBusy] = useState(false)
  const [fulfillError, setFulfillError] = useState("")

  const loadOrders = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const query = status === "all" ? "" : `?status=${encodeURIComponent(status)}`
      const response = await fetch(`/api/admin/domains/orders${query}`, { cache: "no-store" })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to load domain orders.")
      setOrders(result.orders ?? []); setEvents(result.auditEvents ?? [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load domain orders.")
    } finally { setLoading(false) }
  }, [status])

  useEffect(() => { void loadOrders() }, [loadOrders])
  const selectedFulfillmentOrder = orders.find((order) => order.id === fulfillOrderId) ?? null

  async function recordManualRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedFulfillmentOrder?.provider_id) return
    const form = event.currentTarget
    const data = new FormData(form)
    const registeredRaw = String(data.get("registeredAt") || "")
    const expiresRaw = String(data.get("expiresAt") || "")
    const registeredAt = new Date(registeredRaw)
    const expiresAt = new Date(expiresRaw)
    if (Number.isNaN(registeredAt.getTime()) || Number.isNaN(expiresAt.getTime())) {
      setFulfillError("Enter valid registration and expiry dates.")
      return
    }
    if (expiresAt <= registeredAt) {
      setFulfillError("The expiry date must be later than the registration date.")
      return
    }
    if (data.get("availabilityRechecked") !== "on" || data.get("priceRechecked") !== "on") {
      setFulfillError("Confirm that availability and final price were rechecked in the registrar console.")
      return
    }
    if (!window.confirm(`Confirm that ${selectedFulfillmentOrder.domain_name} has already been registered successfully in the registrar console? This only records the external result; it does not register the domain.`)) return

    setFulfillBusy(true); setFulfillError(""); setNotice("")
    try {
      const response = await fetch("/api/admin/domains/orders/fulfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          orderId: selectedFulfillmentOrder.id,
          providerId: selectedFulfillmentOrder.provider_id,
          providerOrderReference: String(data.get("providerOrderReference") || "").trim(),
          providerDomainReference: String(data.get("providerDomainReference") || "").trim(),
          registeredAt: registeredAt.toISOString(),
          expiresAt: expiresAt.toISOString(),
          availabilityRechecked: true,
          priceRechecked: true,
          adminNote: String(data.get("adminNote") || "").trim(),
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to record the registration.")
      await loadOrders()
      setFulfillOrderId("")
      setNotice(`Manual registration recorded for ${selectedFulfillmentOrder.domain_name}. The registrar was not called by HEMBOX.`)
    } catch (e) {
      setFulfillError(e instanceof Error ? e.message : "Unable to record the registration.")
    } finally { setFulfillBusy(false) }
  }


  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/domains" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-teal"><ArrowLeft className="h-4 w-4" /> Catalogue & pricing</Link>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-teal">Operations</p><h1 className="mt-2 text-3xl font-black tracking-tight text-navy">Domain order queue</h1><p className="mt-2 text-sm text-slate-600">Read-only order and audit visibility. No payment or registration actions are available yet.</p></div>
          <div className="flex gap-2">
            <Link href="/admin/domains/recovery" className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">Recovery</Link>
            <select value={status} onChange={(event) => setStatus(event.target.value as (typeof statuses)[number])} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">
              {statuses.map((value) => <option key={value} value={value}>{value === "all" ? "All statuses" : title(value)}</option>)}
            </select>
            <button onClick={() => void loadOrders()} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold disabled:opacity-50"><RefreshCw className="h-4 w-4" /> Refresh</button>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>Manual fulfillment:</strong> the registration action below only records a domain that an administrator has already registered in the registrar console. It does not call NameSilo. Verify settled payment, live availability, final price, and the actual registrar result first.</div>
      {error ? <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</p> : null}\n      {notice ? <p role="status" className="rounded-xl border border-teal/30 bg-teal/5 p-4 text-sm text-navy">{notice}</p> : null}
      {loading ? <div className="flex h-40 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-teal" /></div> : null}
      {!loading && !error && orders.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">No orders match this filter.</div> : null}
      {!loading && orders.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Domain / order</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Registration</th><th className="px-4 py-3">Renewal</th><th className="px-4 py-3">Provider reference</th><th className="px-4 py-3">Created</th><th className="px-4 py-3">Action</th></tr></thead>
            <tbody>{orders.map((order) => <tr key={order.id} className="border-b border-slate-100 last:border-0">
              <td className="px-4 py-4"><p className="font-bold text-navy">{order.domain_name}</p><p className="mt-1 text-xs text-slate-500">{order.id}</p></td>
              <td className="px-4 py-4"><p>{order.customer_name || "Customer"}</p><p className="mt-1 text-xs text-slate-500">{order.customer_email}</p></td>
              <td className="px-4 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold">{title(order.status)}</span></td>
              <td className="px-4 py-4">{money(order.registration_retail_minor, order.retail_currency)}</td><td className="px-4 py-4">{money(order.renewal_retail_minor, order.retail_currency)}</td>
              <td className="px-4 py-4 text-xs">{order.provider_id ? `${order.provider_id}: ${order.provider_order_reference || "No reference"}` : "Not provisioned"}</td><td className="px-4 py-4 text-xs text-slate-500">{new Date(order.created_at).toLocaleDateString()}</td>
            </tr>)}</tbody>
          </table>
        </div>
      ) : null}
      {selectedFulfillmentOrder ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div><p className="text-xs font-bold uppercase tracking-wide text-teal">Manual registrar fulfillment</p><h2 className="mt-1 text-xl font-black text-navy">{selectedFulfillmentOrder.domain_name}</h2><p className="mt-1 text-sm text-slate-600">First register the domain directly in the registrar's console. Only use this form after you have confirmed the successful registration and expiry date.</p></div>
            <button type="button" onClick={() => setFulfillOrderId("")} className="h-9 rounded-lg border border-slate-200 px-3 text-sm font-bold">Cancel</button>
          </div>
          {fulfillError ? <p role="alert" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{fulfillError}</p> : null}
          <form onSubmit={(event) => void recordManualRegistration(event)} className="mt-5 grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="provider-domain-reference" className="block text-xs font-bold text-slate-700">Registered domain reference</label><input id="provider-domain-reference" name="providerDomainReference" defaultValue={selectedFulfillmentOrder.domain_name} required minLength={3} maxLength={253} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" /></div>
            <div><label htmlFor="provider-order-reference" className="block text-xs font-bold text-slate-700">Registrar order/reference (optional)</label><input id="provider-order-reference" name="providerOrderReference" maxLength={200} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" placeholder="Reference from registrar console" /></div>
            <div><label htmlFor="registered-at" className="block text-xs font-bold text-slate-700">Registration date/time</label><input id="registered-at" name="registeredAt" type="datetime-local" required defaultValue={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" /></div>
            <div><label htmlFor="expires-at" className="block text-xs font-bold text-slate-700">Expiry date/time</label><input id="expires-at" name="expiresAt" type="datetime-local" required className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" /></div>
            <div className="sm:col-span-2 space-y-3 rounded-xl bg-slate-50 p-4">
              <label className="flex items-start gap-2 text-sm"><input name="availabilityRechecked" type="checkbox" required className="mt-1" /><span>I rechecked live availability immediately before completing the registration.</span></label>
              <label className="flex items-start gap-2 text-sm"><input name="priceRechecked" type="checkbox" required className="mt-1" /><span>I rechecked the final registrar price and confirmed it against the order/payment terms.</span></label>
              <div><label htmlFor="fulfillment-note" className="block text-xs font-bold text-slate-700">Audit note (optional)</label><textarea id="fulfillment-note" name="adminNote" maxLength={500} rows={2} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm" placeholder="Any relevant reconciliation details" /></div>
            </div>
            <div className="sm:col-span-2"><button type="submit" disabled={fulfillBusy} className="inline-flex h-11 items-center justify-center rounded-xl bg-navy px-5 text-sm font-bold text-white disabled:opacity-50">{fulfillBusy ? "Recording…" : "Confirm already-registered domain"}</button></div>
          </form>
        </section>
      ) : null}
      <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-bold text-navy">Recent audit events</h2>
        {events.length === 0 ? <p className="mt-2 text-sm text-slate-500">No audit events for the returned orders.</p> : <ul className="mt-4 divide-y divide-slate-100">{events.slice(0,20).map((event) => <li key={event.id} className="py-3"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><span className="text-sm font-semibold">{title(event.event_type)}</span><span className="text-xs text-slate-500">{new Date(event.created_at).toLocaleString()}</span></div><p className="mt-1 text-xs text-slate-500">Order {event.order_id || "not linked"} · Actor {event.actor_user_id || "system"}</p></li>)}</ul>}
      </section>
    </div>
  )
}
