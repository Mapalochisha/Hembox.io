"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, CreditCard, Loader2, RefreshCw, ShieldCheck, XCircle } from "lucide-react"

type Invoice = { id: string; invoice_number: string; status: string; currency: string; total_minor: number; due_at: string | null }
type Claim = { id: string; invoice_id: string; customer_id: string; method_key_snapshot: string; method_name_snapshot: string; transaction_reference: string; claimed_amount_minor: number; currency: string; customer_note: string | null; receipt_object_key: string | null; receipt_mime_type: string | null; receipt_size_bytes: number | null; status: string; review_note: string | null; reviewed_at: string | null; created_at: string; invoice: Invoice | null }
type Decision = "verified" | "rejected" | "needs_info"

function money(minor: number, currency: string) {
  try { return new Intl.NumberFormat("en-ZM", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minor / 100) }
  catch { return `${currency} ${(minor / 100).toFixed(2)}` }
}
function date(value: string) { return new Intl.DateTimeFormat("en-ZM", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) }
function title(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) }
function statusStyle(status: string) {
  if (status === "verified") return "bg-emerald-50 text-emerald-700"
  if (status === "rejected") return "bg-rose-50 text-rose-700"
  if (status === "needs_info" || status === "submitted") return "bg-amber-50 text-amber-800"
  return "bg-slate-100 text-slate-600"
}

export default function AdminBillingPaymentsPage() {
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState("")
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [filter, setFilter] = useState<"pending" | "all">("pending")

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const response = await fetch("/api/admin/billing/payments", { cache: "no-store" })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to load payment claims.")
      setClaims(result.claims ?? [])
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load payment claims.") }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const review = async (claim: Claim, decision: Decision) => {
    const note = (notes[claim.id] ?? "").trim()
    if ((decision === "needs_info" || decision === "rejected") && !note) { setError("Add a review note when requesting information or rejecting a claim."); return }
    if (decision === "verified" && !window.confirm("Confirm that the funds were independently verified in the receiving account? A verified claim will create a payment record and allocate the amount to the invoice.")) return
    setBusyId(claim.id); setError(""); setNotice("")
    try {
      const response = await fetch("/api/admin/billing/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ claimId: claim.id, decision, reviewNote: note || undefined }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to review payment claim.")
      setNotice(decision === "verified" ? "Payment verified and allocated to the invoice." : decision === "needs_info" ? "More information requested from the customer." : "Payment claim rejected.")
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to review payment claim.") }
    finally { setBusyId("") }
  }

  const visible = claims.filter((claim) => filter === "all" || claim.status === "submitted" || claim.status === "needs_info")

  return <main className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><Link href="/admin" className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-navy"><ArrowLeft className="h-4 w-4" /> Admin dashboard</Link><p className="text-xs font-bold uppercase tracking-[0.18em] text-teal">Finance operations</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-navy">Payment claim review</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Verify money received before approving a claim. A receipt or transaction reference alone is not proof of settlement.</p></div>
      <button onClick={() => void load()} className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"><RefreshCw className="h-4 w-4" /> Refresh queue</button>
    </div>
    {error && <div role="alert" className="flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertCircle className="h-5 w-5 shrink-0" />{error}</div>}
    {notice && <div role="status" className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 className="h-5 w-5 shrink-0" />{notice}</div>}
    <div className="grid gap-4 sm:grid-cols-3">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2 text-sm text-slate-500"><Clock3 className="h-4 w-4 text-amber-500" /> Awaiting review</div><p className="mt-3 text-3xl font-bold text-navy">{claims.filter((claim) => claim.status === "submitted" || claim.status === "needs_info").length}</p></section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2 text-sm text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Verified claims</div><p className="mt-3 text-3xl font-bold text-navy">{claims.filter((claim) => claim.status === "verified").length}</p></section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2 text-sm text-slate-500"><XCircle className="h-4 w-4 text-rose-500" /> Rejected claims</div><p className="mt-3 text-3xl font-bold text-navy">{claims.filter((claim) => claim.status === "rejected").length}</p></section>
    </div>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-navy">Manual payment claims</h2><p className="mt-1 text-xs text-slate-500">Review transaction references against the receiving account.</p></div><div className="flex gap-1 rounded-xl bg-slate-100 p-1"><button onClick={() => setFilter("pending")} className={`rounded-lg px-3 py-2 text-xs font-semibold ${filter === "pending" ? "bg-white text-navy shadow-sm" : "text-slate-500"}`}>Needs review</button><button onClick={() => setFilter("all")} className={`rounded-lg px-3 py-2 text-xs font-semibold ${filter === "all" ? "bg-white text-navy shadow-sm" : "text-slate-500"}`}>All claims</button></div></div>
      {loading ? <div className="flex items-center justify-center gap-3 p-14 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading claims…</div> : visible.length === 0 ? <div className="p-14 text-center"><CreditCard className="mx-auto h-8 w-8 text-slate-400" /><p className="mt-3 font-semibold text-navy">No payment claims here</p><p className="mt-1 text-sm text-slate-500">New claims will appear in this queue.</p></div> :
      <div className="divide-y divide-slate-100">{visible.map((claim) => {
        const pending = claim.status === "submitted" || claim.status === "needs_info"
        return <article key={claim.id} className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-semibold text-navy">{claim.invoice?.invoice_number ?? "Invoice unavailable"}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle(claim.status)}`}>{title(claim.status)}</span></div>
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
                <div><p className="text-xs font-medium uppercase tracking-wider text-slate-400">Claimed amount</p><p className="mt-1 font-semibold text-navy">{money(Number(claim.claimed_amount_minor),claim.currency)}</p><p className="text-xs text-slate-500">Invoice balance status: {title(claim.invoice?.status ?? "unknown")}</p></div>
                <div><p className="text-xs font-medium uppercase tracking-wider text-slate-400">Payment method</p><p className="mt-1 font-medium text-slate-800">{claim.method_name_snapshot}</p><p className="text-xs text-slate-500">Ref: {claim.transaction_reference}</p></div>
                <div><p className="text-xs font-medium uppercase tracking-wider text-slate-400">Submitted</p><p className="mt-1 text-slate-800">{date(claim.created_at)}</p><p className="break-all text-xs text-slate-500">Customer ID: {claim.customer_id}</p></div>
              </div>
              {claim.customer_note && <div className="mt-4 rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-500">Customer note</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{claim.customer_note}</p></div>}
              {claim.receipt_object_key && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Receipt evidence is recorded in private storage. Evidence viewing is not enabled in this initial phase; verify the funds directly in the receiving account.</div>}
              {claim.review_note && <p className="mt-3 text-sm text-slate-600">Previous review note: {claim.review_note}</p>}
            </div>
            {pending && <div className="w-full shrink-0 xl:max-w-sm"><label className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Review note</span><textarea value={notes[claim.id] ?? ""} onChange={(event) => setNotes((previous) => ({ ...previous, [claim.id]: event.target.value }))} rows={2} maxLength={1000} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal" placeholder="Reason or details requested" /></label><div className="mt-3 grid grid-cols-2 gap-2"><button disabled={busyId === claim.id} onClick={() => void review(claim,"needs_info")} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-900 disabled:opacity-50">Request info</button><button disabled={busyId === claim.id} onClick={() => void review(claim,"rejected")} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-800 disabled:opacity-50">Reject</button><button disabled={busyId === claim.id} onClick={() => void review(claim,"verified")} className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{busyId === claim.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Confirm funds received & allocate</button></div></div>}
          </div>
        </article>
      })}</div>}
    </section>
  </main>
}
