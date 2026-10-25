"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { ArrowLeft, CheckCircle2, Loader2, RefreshCw, XCircle, MessageSquareText } from "lucide-react"

type Claim = {
  id: string; order_id: string; customer_id: string; payment_reference: string
  transaction_reference: string; amount_minor: number; currency: string
  customer_note: string | null; status: string; review_note: string | null
  created_at: string
}
type DomainOrder = { id: string; domain_name: string; status: string; customer_email: string; customer_name: string | null }

function money(minor: number, currency: string) {
  return new Intl.NumberFormat("en-ZM", { style: "currency", currency, maximumFractionDigits: 2 }).format(minor / 100)
}
function title(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) }

export default function AdminManualPaymentsPage() {
  const [claims, setClaims] = useState<Claim[]>([])
  const [orders, setOrders] = useState<DomainOrder[]>([])
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const load = useCallback(async () => {
    setLoading(true); setError(""); setNotice("")
    try {
      const response = await fetch("/api/admin/domains/manual-payments", { cache: "no-store" })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to load payment claims.")
      setClaims(result.claims ?? []); setOrders(result.orders ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load payment claims.")
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  async function review(claim: Claim, decision: "verified" | "rejected" | "needs_info") {
    if (decision === "verified" && !window.confirm("Confirm that you have checked the receiving account and the exact funds have settled? A submitted receipt is not enough.")) return
    setBusyId(claim.id); setError(""); setNotice("")
    try {
      const response = await fetch("/api/admin/domains/manual-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ claimId: claim.id, decision, reviewNote: notes[claim.id] || "" }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to save the review.")
      setNotice(decision === "verified" ? "Payment verified. The order is now eligible for the next guarded workflow step; this does not register the domain." : `Claim marked ${title(decision).toLowerCase()}.`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save the review.")
    } finally { setBusyId("") }
  }

  const orderById = new Map(orders.map((order) => [order.id, order]))

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/domains/orders" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-teal"><ArrowLeft className="h-4 w-4" /> Domain orders</Link>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-teal">Operations</p><h1 className="mt-2 text-3xl font-black tracking-tight text-navy">Manual payment review</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Verify actual settled funds in the receiving account before confirming a claim. Customer receipts and screenshots are not proof of settlement.</p></div>
          <button onClick={() => void load()} disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold disabled:opacity-50"><RefreshCw className="h-4 w-4" /> Refresh</button>
        </div>
      </div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>Safety rule:</strong> “Verify funds” changes the order to payment-confirmed only after the database checks the claim amount against the saved quote. Registration remains a separate, gated operation.</div>
      {error ? <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</p> : null}
      {notice ? <p role="status" className="rounded-xl border border-teal/30 bg-teal/5 p-4 text-sm text-navy">{notice}</p> : null}
      {loading ? <div className="flex h-40 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-teal" /></div> : null}
      {!loading && claims.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">No manual payment claims have been submitted.</div> : null}
      <div className="space-y-4">
        {claims.map((claim) => {
          const order = orderById.get(claim.order_id)
          const active = claim.status === "submitted" || claim.status === "needs_info"
          return <article key={claim.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{claim.payment_reference}</p><h2 className="mt-1 text-xl font-black text-navy">{order?.domain_name || "Unknown domain order"}</h2><p className="mt-1 text-xs text-slate-500">Order {claim.order_id} · Claim {claim.id}</p><p className="mt-2 text-sm">{order?.customer_name || "Customer"} · {order?.customer_email || "Email unavailable"}</p></div>
              <div className="sm:text-right"><p className="text-xl font-black text-navy">{money(claim.amount_minor, claim.currency)}</p><span className="mt-1 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold">{title(claim.status)}</span><p className="mt-1 text-xs text-slate-500">Submitted {new Date(claim.created_at).toLocaleString()}</p></div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-500">Customer transaction reference</p><p className="mt-1 break-all text-sm font-bold">{claim.transaction_reference}</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-500">Order status</p><p className="mt-1 text-sm font-bold">{order ? title(order.status) : "Unavailable"}</p></div>
            </div>
            {claim.customer_note ? <p className="mt-3 text-sm text-slate-600">Customer note: {claim.customer_note}</p> : null}
            {claim.review_note ? <p className="mt-2 text-sm text-slate-600">Previous review note: {claim.review_note}</p> : null}
            {active ? <div className="mt-4 border-t border-slate-100 pt-4">
              <label className="block text-xs font-bold text-slate-600" htmlFor={`review-${claim.id}`}>Review note (optional)</label>
              <textarea id={`review-${claim.id}`} value={notes[claim.id] || ""} onChange={(event) => setNotes((previous) => ({ ...previous, [claim.id]: event.target.value }))} maxLength={500} rows={2} placeholder="Record the reconciliation detail or what the customer must clarify." className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-teal" />
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => void review(claim, "verified")} disabled={!!busyId} className="inline-flex h-10 items-center gap-2 rounded-xl bg-teal px-4 text-sm font-bold text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4" /> {busyId === claim.id ? "Saving…" : "Verify funds"}</button>
                <button onClick={() => void review(claim, "needs_info")} disabled={!!busyId} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold disabled:opacity-50"><MessageSquareText className="h-4 w-4" /> Need more info</button>
                <button onClick={() => void review(claim, "rejected")} disabled={!!busyId} className="inline-flex h-10 items-center gap-2 rounded-xl border border-rose-200 px-4 text-sm font-bold text-rose-700 disabled:opacity-50"><XCircle className="h-4 w-4" /> Reject claim</button>
              </div>
            </div> : null}
          </article>
        })}
      </div>
    </div>
  )
}
