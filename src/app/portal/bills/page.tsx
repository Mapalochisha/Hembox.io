"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Navbar } from "@/components/landing/navbar"
import { useAuth } from "@/components/providers/auth-provider"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { AlertCircle, CheckCircle2, Clock3, CreditCard, FileText, Loader2, RefreshCw, Search, Wallet } from "lucide-react"

type InvoiceStatus = "draft" | "unpaid" | "partially_paid" | "paid" | "overdue" | "void"
type Invoice = { id: string; invoice_number: string; status: InvoiceStatus; currency: string; subtotal_minor: number; tax_minor: number; total_minor: number; issued_at: string | null; due_at: string | null; source_type: string | null; source_id: string | null; created_at: string }
type Claim = { id: string; invoice_id: string; status: string; claimed_amount_minor: number; currency: string; transaction_reference: string; review_note: string | null; created_at: string }
type Allocation = { invoice_id: string; amount_minor: number; currency: string; allocation_type: string }
type PaymentMethod = { id: string; method_key: string; display_name: string; instructions: string; version: number; supported_currencies: string[] }
type TabKey = "all" | "unpaid" | "under_review" | "paid"

const tabs: { key: TabKey; label: string }[] = [
  { key: "all", label: "All invoices" },
  { key: "unpaid", label: "Unpaid" },
  { key: "under_review", label: "Under review" },
  { key: "paid", label: "Paid" },
]

function money(minor: number, currency: string) {
  try { return new Intl.NumberFormat("en-ZM", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minor / 100) }
  catch { return `${currency} ${(minor / 100).toFixed(2)}` }
}
function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat("en-ZM", { dateStyle: "medium" }).format(new Date(value)) : "—" }
function label(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) }
function statusClass(status: string) {
  if (status === "paid" || status === "verified") return "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
  if (status === "under_review" || status === "submitted" || status === "needs_info") return "bg-amber-50 text-amber-800 ring-amber-600/20"
  if (status === "overdue" || status === "rejected") return "bg-rose-50 text-rose-700 ring-rose-600/20"
  if (status === "partially_paid") return "bg-sky-50 text-sky-700 ring-sky-600/20"
  return "bg-slate-100 text-slate-600 ring-slate-500/10"
}
function parseMinor(value: string): number | null {
  const match = value.trim().match(/^(\d+)(?:\.(\d{1,2}))?$/)
  if (!match) return null
  const minor = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0") || "0")
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null
}

export default function BillsPage() {
  const { user, isLoading: authLoading } = useAuth()
  const [supabase] = useState(() => isSupabaseConfigured() ? createClient() : null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [claims, setClaims] = useState<Claim[]>([])
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [tab, setTab] = useState<TabKey>("all")
  const [search, setSearch] = useState("")
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const [methodId, setMethodId] = useState("")
  const [amount, setAmount] = useState("")
  const [transactionReference, setTransactionReference] = useState("")
  const [customerNote, setCustomerNote] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    if (!supabase || !user) { setLoading(false); return }
    setLoading(true); setError("")
    const [invoiceResult, claimResult, allocationResult, methodResult] = await Promise.all([
      supabase.from("billing_invoices").select("id,invoice_number,status,currency,subtotal_minor,tax_minor,total_minor,issued_at,due_at,source_type,source_id,created_at").order("created_at", { ascending: false }),
      supabase.from("billing_payment_claims").select("id,invoice_id,status,claimed_amount_minor,currency,transaction_reference,review_note,created_at").order("created_at", { ascending: false }),
      supabase.from("billing_payment_allocations").select("invoice_id,amount_minor,currency,allocation_type"),
      supabase.from("billing_payment_methods").select("id,method_key,display_name,instructions,version,supported_currencies").eq("active", true).order("display_name"),
    ])
    const failed = invoiceResult.error || claimResult.error || allocationResult.error || methodResult.error
    if (failed) {
      console.error("[Billing] Unable to load billing data:", failed)
      setError("We could not load your billing information. Refresh the page or try again shortly.")
    } else {
      setInvoices((invoiceResult.data ?? []) as Invoice[])
      setClaims((claimResult.data ?? []) as Claim[])
      setAllocations((allocationResult.data ?? []) as Allocation[])
      setMethods((methodResult.data ?? []) as PaymentMethod[])
    }
    setLoading(false)
  }, [supabase, user])

  useEffect(() => { if (!authLoading) void load() }, [authLoading, load])

  const claimsByInvoice = useMemo(() => {
    const map = new Map<string, Claim[]>()
    for (const claim of claims) map.set(claim.invoice_id, [...(map.get(claim.invoice_id) ?? []), claim])
    return map
  }, [claims])
  const allocatedByInvoice = useMemo(() => {
    const map = new Map<string, number>()
    for (const allocation of allocations) map.set(allocation.invoice_id, (map.get(allocation.invoice_id) ?? 0) + (allocation.allocation_type === "reverse" ? -Number(allocation.amount_minor) : Number(allocation.amount_minor)))
    return map
  }, [allocations])
  const outstanding = (invoice: Invoice) => Math.max(0, Number(invoice.total_minor) - (allocatedByInvoice.get(invoice.id) ?? 0))
  const hasReview = (invoiceId: string) => (claimsByInvoice.get(invoiceId) ?? []).some((claim) => claim.status === "submitted" || claim.status === "needs_info")

  const visibleInvoices = invoices.filter((invoice) => {
    const query = search.trim().toLowerCase()
    const matchesSearch = !query || [invoice.invoice_number, invoice.source_type ?? "", invoice.source_id ?? ""].some((value) => value.toLowerCase().includes(query))
    const matchesTab = tab === "all" || (tab === "under_review" ? hasReview(invoice.id) : tab === "unpaid" ? outstanding(invoice) > 0 && invoice.status !== "draft" && invoice.status !== "void" : invoice.status === "paid")
    return matchesSearch && matchesTab && invoice.status !== "draft" && invoice.status !== "void"
  })

  const currencies = Array.from(new Set(invoices.filter((invoice) => invoice.status !== "draft" && invoice.status !== "void").map((invoice) => invoice.currency)))
  const totals = currencies.map((currency) => {
    const matching = invoices.filter((invoice) => invoice.currency === currency && invoice.status !== "draft" && invoice.status !== "void")
    const due = matching.reduce((sum, invoice) => sum + outstanding(invoice), 0)
    const paid = allocations.filter((allocation) => allocation.currency === currency).reduce((sum, allocation) => sum + (allocation.allocation_type === "reverse" ? -Number(allocation.amount_minor) : Number(allocation.amount_minor)), 0)
    return { currency, due, paid }
  })
  const reviewCount = claims.filter((claim) => claim.status === "submitted" || claim.status === "needs_info").length

  const openPayModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setMethodId(methods.find((method) => method.supported_currencies.includes(invoice.currency))?.id ?? "")
    setAmount((outstanding(invoice) / 100).toFixed(2))
    setTransactionReference(""); setCustomerNote(""); setError(""); setNotice("")
  }

  const submitClaim = async () => {
    if (!selectedInvoice) return
    const amountMinor = parseMinor(amount)
    if (!methodId) { setError("Choose an available payment method."); return }
    if (amountMinor === null || amountMinor > outstanding(selectedInvoice)) { setError("Enter a valid amount that does not exceed the outstanding balance."); return }
    if (transactionReference.trim().length < 3) { setError("Enter the transaction reference shown by your bank or mobile-money provider."); return }
    setSubmitting(true); setError(""); setNotice("")
    try {
      const response = await fetch("/api/billing/claims", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: selectedInvoice.id, paymentMethodId: methodId, idempotencyKey: `bill-${crypto.randomUUID()}`, transactionReference: transactionReference.trim(), amountMinor, customerNote: customerNote.trim() || undefined }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to submit payment claim.")
      setSelectedInvoice(null)
      setNotice("Payment claim submitted. Your invoice balance will change only after the payment is verified.")
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to submit payment claim.") }
    finally { setSubmitting(false) }
  }

  const selectedMethod = methods.find((method) => method.id === methodId)

  if (authLoading || loading) return <div className="min-h-screen bg-slate-50"><Navbar /><div className="mx-auto flex min-h-[60vh] max-w-6xl items-center justify-center px-6"><Loader2 className="h-7 w-7 animate-spin text-teal" /><span className="ml-3 text-sm text-slate-500">Loading your bills…</span></div></div>
  if (!user) return <div className="min-h-screen bg-slate-50"><Navbar /><main className="mx-auto max-w-3xl px-6 pb-20 pt-36 text-center"><h1 className="text-3xl font-bold text-navy">Sign in to view your bills</h1><p className="mt-3 text-slate-600">Your invoices and payment claims are private to your account.</p><Link href="/login" className="mt-6 inline-flex rounded-xl bg-navy px-5 py-3 font-semibold text-white">Sign in</Link></main></div>

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 pb-20 pt-28 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-teal">Account centre</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-navy sm:text-4xl">Bills & payments</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Review invoices, track payment claims, and submit manual payment details securely.</p></div>
          <button onClick={() => void load()} className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 sm:self-auto"><RefreshCw className="h-4 w-4" /> Refresh</button>
        </div>

        {error && <div role="alert" className="mb-5 flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><span>{error}</span></div>}
        {notice && <div role="status" className="mb-5 flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /><span>{notice}</span></div>}

        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><span className="text-sm font-medium text-slate-500">Outstanding balance</span><Wallet className="h-5 w-5 text-teal" /></div><div className="mt-4 space-y-1">{totals.length ? totals.map((item) => <p key={item.currency} className="text-2xl font-bold tracking-tight text-navy">{money(item.due,item.currency)}</p>) : <p className="text-2xl font-bold text-navy">—</p>}</div><p className="mt-2 text-xs text-slate-500">Balances stay separate by currency.</p></section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><span className="text-sm font-medium text-slate-500">Claims under review</span><Clock3 className="h-5 w-5 text-amber-500" /></div><p className="mt-4 text-3xl font-bold tracking-tight text-navy">{reviewCount}</p><p className="mt-2 text-xs text-slate-500">Claims do not count as paid until verified.</p></section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><span className="text-sm font-medium text-slate-500">Total allocated</span><CheckCircle2 className="h-5 w-5 text-emerald-600" /></div><div className="mt-4 space-y-1">{totals.length ? totals.map((item) => <p key={item.currency} className="text-2xl font-bold tracking-tight text-navy">{money(item.paid,item.currency)}</p>) : <p className="text-2xl font-bold text-navy">—</p>}</div><p className="mt-2 text-xs text-slate-500">Based on verified allocations.</p></section>
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">{tabs.map((item) => <button key={item.key} onClick={() => setTab(item.key)} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === item.key ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{item.label}</button>)}</div>
              <label className="relative block w-full lg:max-w-xs"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search invoice or service…" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/15" /></label>
            </div>
          </div>
          {visibleInvoices.length === 0 ? <div className="px-6 py-16 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100"><FileText className="h-6 w-6 text-slate-500" /></div><h2 className="mt-4 text-lg font-semibold text-navy">No invoices found</h2><p className="mt-1 text-sm text-slate-500">{search ? "Try a different search term." : "When HEMBOX issues an invoice, it will appear here."}</p></div> :
          <div className="overflow-x-auto"><table className="w-full min-w-[850px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3 font-semibold">Invoice</th><th className="px-5 py-3 font-semibold">Service</th><th className="px-5 py-3 font-semibold">Dates</th><th className="px-5 py-3 font-semibold">Amount due</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3 text-right font-semibold">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{visibleInvoices.map((invoice) => {
              const due = outstanding(invoice)
              const review = hasReview(invoice.id)
              const invoiceClaims = claimsByInvoice.get(invoice.id) ?? []
              const displayStatus = review ? "under_review" : due === 0 ? "paid" : invoice.status === "overdue" ? "overdue" : due < invoice.total_minor ? "partially_paid" : "unpaid"
              return <tr key={invoice.id} className="align-top hover:bg-slate-50/70">
                <td className="px-5 py-4"><p className="font-semibold text-navy">{invoice.invoice_number}</p><p className="mt-1 text-xs text-slate-500">{invoice.currency}</p></td>
                <td className="px-5 py-4"><p className="font-medium text-slate-800">{label(invoice.source_type ?? "service")}</p>{invoice.source_id && <p className="mt-1 max-w-[180px] truncate text-xs text-slate-500">{invoice.source_id}</p>}</td>
                <td className="px-5 py-4 text-slate-600"><p>Issued {formatDate(invoice.issued_at)}</p><p className="mt-1 text-xs">Due {formatDate(invoice.due_at)}</p></td>
                <td className="px-5 py-4"><p className="font-semibold text-navy">{money(due,invoice.currency)}</p><p className="mt-1 text-xs text-slate-500">of {money(Number(invoice.total_minor),invoice.currency)}</p></td>
                <td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusClass(displayStatus)}`}>{label(displayStatus)}</span>{invoiceClaims.filter((claim) => claim.status === "rejected" || claim.status === "needs_info").slice(0,1).map((claim) => <p key={claim.id} className="mt-2 max-w-[180px] text-xs text-amber-800">{claim.review_note || (claim.status === "needs_info" ? "More information requested" : "Claim rejected")}</p>)}</td>
                <td className="px-5 py-4"><div className="flex justify-end gap-2"><button onClick={() => setDetailsId(detailsId === invoice.id ? null : invoice.id)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white">Details</button>{due > 0 && !review && <button onClick={() => openPayModal(invoice)} className="rounded-lg bg-navy px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800">Pay bill</button>}</div></td>
              </tr>
            })}</tbody>
          </table></div>}
          {visibleInvoices.filter((invoice) => detailsId === invoice.id).map((invoice) => <div key={`details-${invoice.id}`} className="border-t border-slate-200 bg-slate-50 px-5 py-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-semibold text-navy">{invoice.invoice_number} details</h3><p className="mt-1 text-sm text-slate-600">Invoice total: {money(Number(invoice.total_minor),invoice.currency)} · Allocated: {money(allocatedByInvoice.get(invoice.id) ?? 0,invoice.currency)} · Balance: {money(outstanding(invoice),invoice.currency)}</p><p className="mt-2 text-xs text-slate-500">Issued {formatDate(invoice.issued_at)} · Due {formatDate(invoice.due_at)}</p></div></div><div className="mt-4 space-y-2">{(claimsByInvoice.get(invoice.id) ?? []).map((claim) => <div key={claim.id} className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium text-slate-800">{claim.transaction_reference}</p><p className="text-xs text-slate-500">{formatDate(claim.created_at)} · {money(Number(claim.claimed_amount_minor),claim.currency)}</p></div><span className={`inline-flex self-start rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusClass(claim.status)}`}>{label(claim.status)}</span>{claim.review_note && <p className="text-xs text-slate-600">{claim.review_note}</p>}</div>)}</div></div>)}
        </section>

        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><p>Submitting payment details only creates a claim for review. Your invoice balance changes after HEMBOX verifies the funds and records the allocation. Never send passwords, PINs, or one-time codes in a payment note.</p></div>
      </main>

      {selectedInvoice && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) setSelectedInvoice(null) }}>
        <section role="dialog" aria-modal="true" aria-labelledby="payment-modal-title" className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7">
          <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-teal">Manual payment</p><h2 id="payment-modal-title" className="mt-1 text-2xl font-bold text-navy">Pay {selectedInvoice.invoice_number}</h2><p className="mt-1 text-sm text-slate-500">Outstanding: {money(outstanding(selectedInvoice),selectedInvoice.currency)}</p></div><button onClick={() => setSelectedInvoice(null)} disabled={submitting} aria-label="Close payment form" className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100">✕</button></div>
          {error && <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
          <div className="mt-5 space-y-4">
            <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Payment method</span><select value={methodId} onChange={(event) => setMethodId(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-teal" required><option value="">Choose a method</option>{methods.filter((method) => method.supported_currencies.includes(selectedInvoice.currency)).map((method) => <option key={method.id} value={method.id}>{method.display_name}</option>)}</select></label>
            {selectedMethod && <div className="rounded-xl border border-teal/20 bg-teal/5 p-4"><p className="text-xs font-bold uppercase tracking-wider text-teal">Payment instructions</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selectedMethod.instructions}</p><p className="mt-2 text-xs text-slate-500">Version {selectedMethod.version} will be saved with your claim.</p></div>}
            <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Amount paid ({selectedInvoice.currency})</span><input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-teal" placeholder="0.00" required /><span className="mt-1 block text-xs text-slate-500">Maximum {money(outstanding(selectedInvoice),selectedInvoice.currency)}. Partial payments are accepted.</span></label>
            <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Transaction reference</span><input value={transactionReference} onChange={(event) => setTransactionReference(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-teal" placeholder="Reference from your bank or mobile-money receipt" required maxLength={160} /></label>
            <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Note (optional)</span><textarea value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} rows={3} maxLength={1000} className="w-full resize-y rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-teal" placeholder="Anything the payment reviewer should know" /></label>
            <p className="text-xs leading-5 text-slate-500">Receipt upload will be enabled with the private evidence-storage step. For now, submit the transaction reference; HEMBOX will verify the actual funds before crediting your invoice.</p>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button onClick={() => setSelectedInvoice(null)} disabled={submitting} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">Cancel</button><button onClick={() => void submitClaim()} disabled={submitting || !methodId} className="inline-flex items-center justify-center gap-2 rounded-xl bg-navy px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />} Submit payment claim</button></div>
        </section>
      </div>}
      <div className="hidden print:block"><p>HEMBOX.io billing statement</p></div>
    </div>
  )
}
