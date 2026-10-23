"use client"

import Link from "next/link"
import { FormEvent, useCallback, useEffect, useState } from "react"
import { AlertCircle, ArrowLeft, CheckCircle2, ClipboardList, CreditCard, FileText, Loader2, Plus, RefreshCw } from "lucide-react"

type Customer = { id: string; email: string | null; full_name: string | null }
type ItemDraft = { description: string; quantity: string; unitPrice: string }
type Invoice = { id: string; invoice_number: string; customer_id: string; status: string; currency: string; subtotal_minor: number; tax_minor: number; total_minor: number; issued_at: string | null; due_at: string | null; source_type: string | null; customer: Customer | null; items: { id: string; description: string; quantity: number; line_total_minor: number }[] }
type SourceType = "website_plan" | "domain_registration" | "domain_renewal" | "addon" | "custom_work" | "adjustment" | "other"
const sourceTypes: SourceType[] = ["website_plan","domain_registration","domain_renewal","addon","custom_work","adjustment","other"]
function money(minor: number, currency: string) { try { return new Intl.NumberFormat("en-ZM", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minor / 100) } catch { return `${currency} ${(minor / 100).toFixed(2)}` } }
function parseMinor(value: string) { const match = value.trim().match(/^(\d+)(?:\.(\d{1,2}))?$/); if (!match) return null; const amount = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2,"0") || "0"); return Number.isSafeInteger(amount) && amount >= 0 ? amount : null }
function title(value: string) { return value.replaceAll("_"," ").replace(/\b\w/g, (letter) => letter.toUpperCase()) }

export default function AdminBillingInvoicesPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [customerId, setCustomerId] = useState("")
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [currency, setCurrency] = useState<"ZMW" | "USD">("ZMW")
  const [usdClientRequested, setUsdClientRequested] = useState(false)
  const [dueDate, setDueDate] = useState("")
  const [sourceType, setSourceType] = useState<SourceType>("custom_work")
  const [sourceId, setSourceId] = useState("")
  const [customerNote, setCustomerNote] = useState("")
  const [items, setItems] = useState<ItemDraft[]>([{ description: "", quantity: "1", unitPrice: "" }])

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const response = await fetch("/api/admin/billing/invoices", { cache: "no-store" })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to load billing records.")
      setInvoices(result.invoices ?? []); setCustomers(result.customers ?? [])
      if (!customerId && result.customers?.length) setCustomerId(result.customers[0].id)
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load billing records.") }
    finally { setLoading(false) }
  }, [customerId])
  useEffect(() => { void load() }, [load])

  const subtotal = items.reduce((sum, item) => { const amount = parseMinor(item.unitPrice); const quantity = Number(item.quantity); return amount !== null && Number.isInteger(quantity) && quantity > 0 ? sum + amount * quantity : sum }, 0)
  const updateItem = (index: number, field: keyof ItemDraft, value: string) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item))

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setNotice("")
    if (!customerId) { setError("Choose a customer."); return }
    if (currency === "USD" && !usdClientRequested) { setError("Confirm that the client explicitly requested USD before issuing a USD invoice."); return }
    if (items.some((item) => !item.description.trim() || parseMinor(item.unitPrice) === null || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1)) { setError("Complete every line item with a valid description, quantity, and amount."); return }
    if (!Number.isSafeInteger(subtotal) || subtotal < 0) { setError("Invoice total is outside the supported amount range."); return }
    setSubmitting(true)
    try {
      const response = await fetch("/api/admin/billing/invoices", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, invoiceNumber: invoiceNumber.trim(), currency, usdClientRequested, dueAt: dueDate ? new Date(`${dueDate}T23:59:59.000Z`).toISOString() : null, sourceType, sourceId: sourceId.trim() || null, customerNote: customerNote.trim() || undefined, creationKey: `invoice-${crypto.randomUUID()}`, items: items.map((item) => ({ description: item.description.trim(), quantity: Number(item.quantity), unitAmountMinor: parseMinor(item.unitPrice) })) }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to issue invoice.")
      setNotice(`Invoice ${result.result?.invoice_number ?? invoiceNumber} issued successfully.`)
      setInvoiceNumber(""); setSourceId(""); setCustomerNote(""); setItems([{ description: "", quantity: "1", unitPrice: "" }])
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to issue invoice.") }
    finally { setSubmitting(false) }
  }

  return <main className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><Link href="/admin" className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-navy"><ArrowLeft className="h-4 w-4" /> Admin dashboard</Link><p className="text-xs font-bold uppercase tracking-[0.18em] text-teal">Finance operations</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-navy">Invoices</h1><p className="mt-2 text-sm text-slate-600">Issue auditable invoices for plans, domains, add-ons, and custom work.</p></div><div className="flex gap-2"><Link href="/admin/billing/payments" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"><CreditCard className="h-4 w-4" /> Payment claims</Link><button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"><RefreshCw className="h-4 w-4" /> Refresh</button></div></div>
    {error && <div role="alert" className="flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertCircle className="h-5 w-5 shrink-0" />{error}</div>}
    {notice && <div role="status" className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 className="h-5 w-5 shrink-0" />{notice}</div>}
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="mb-5"><h2 className="text-lg font-semibold text-navy">Issue an invoice</h2><p className="mt-1 text-sm text-slate-500">Invoice totals are calculated on the server. Issued currency and commercial totals cannot be silently edited.</p></div>
      <form onSubmit={submit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Customer</span><select value={customerId} onChange={(event) => setCustomerId(event.target.value)} required className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-teal"><option value="">Select customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.full_name || customer.email || customer.id} {customer.email && customer.full_name ? `· ${customer.email}` : ""}</option>)}</select></label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Invoice number</span><input value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} required minLength={4} maxLength={40} pattern="[A-Za-z0-9][A-Za-z0-9._/-]+" placeholder="HEM-2026-0001" className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-teal" /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Currency</span><select value={currency} onChange={(event) => { setCurrency(event.target.value as "ZMW" | "USD"); setUsdClientRequested(false) }} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-teal"><option value="ZMW">ZMW — Zambian kwacha (default)</option><option value="USD">USD — US dollar</option></select></label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Due date (optional)</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-teal" /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Charge type</span><select value={sourceType} onChange={(event) => setSourceType(event.target.value as SourceType)} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-teal">{sourceTypes.map((source) => <option key={source} value={source}>{title(source)}</option>)}</select></label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Source reference ID (optional)</span><input value={sourceId} onChange={(event) => setSourceId(event.target.value)} placeholder="Related order or project UUID" className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-teal" /></label>
        </div>
        {currency === "USD" && <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><input type="checkbox" checked={usdClientRequested} onChange={(event) => setUsdClientRequested(event.target.checked)} className="mt-1" /><span><strong>Client explicitly requested USD.</strong><br />Confirm this before issuing a USD invoice. No automatic currency conversion is performed.</span></label>}
        <div className="rounded-2xl border border-slate-200"><div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><div><h3 className="font-semibold text-navy">Line items</h3><p className="mt-1 text-xs text-slate-500">Enter prices in the selected currency.</p></div><button type="button" onClick={() => setItems((current) => current.length < 50 ? [...current, { description: "", quantity: "1", unitPrice: "" }] : current)} disabled={items.length >= 50} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"><Plus className="h-4 w-4" /> Add item</button></div>
          <div className="space-y-3 p-4">{items.map((item, index) => <div key={index} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_100px_150px_80px]"><label className="block"><span className="mb-1 block text-xs font-semibold text-slate-500">Description</span><input value={item.description} onChange={(event) => updateItem(index,"description",event.target.value)} required maxLength={240} placeholder="Website development" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal" /></label><label className="block"><span className="mb-1 block text-xs font-semibold text-slate-500">Quantity</span><input type="number" min="1" max="10000" step="1" value={item.quantity} onChange={(event) => updateItem(index,"quantity",event.target.value)} required className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal" /></label><label className="block"><span className="mb-1 block text-xs font-semibold text-slate-500">Unit price</span><input inputMode="decimal" value={item.unitPrice} onChange={(event) => updateItem(index,"unitPrice",event.target.value)} required placeholder="0.00" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal" /></label><div className="flex items-end"><button type="button" onClick={() => setItems((current) => current.length > 1 ? current.filter((_,itemIndex) => itemIndex !== index) : current)} disabled={items.length === 1} className="w-full rounded-lg border border-slate-200 px-2 py-2.5 text-xs font-semibold text-slate-500 disabled:opacity-30">Remove</button></div></div>)}</div>
          <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50 px-4 py-4 text-right"><span className="text-xs text-slate-500">Tax/adjustments are not added automatically in this form.</span><span className="text-sm text-slate-600">Subtotal</span><strong className="text-2xl text-navy">{money(subtotal,currency)}</strong></div>
        </div>
        <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Customer note (optional)</span><textarea value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} maxLength={1000} rows={2} placeholder="Payment instructions or service context" className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-teal" /></label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-2xl text-xs leading-5 text-slate-500">Issuing creates an unpaid invoice. It does not record payment or trigger service/domain fulfilment. Check the customer, amount, currency, and invoice number before issuing.</p><button type="submit" disabled={submitting || loading || !customers.length} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-navy px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />} Issue invoice</button></div>
      </form>
    </section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="font-semibold text-navy">Recent invoices</h2><p className="mt-1 text-xs text-slate-500">Issued financial records are immutable except through an audited amendment process.</p></div><FileText className="h-5 w-5 text-slate-400" /></div>
      {loading ? <div className="flex items-center justify-center gap-3 p-12 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading invoices…</div> : invoices.length === 0 ? <p className="p-12 text-center text-sm text-slate-500">No invoices have been issued yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[750px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Invoice</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Issued</th><th className="px-5 py-3">Total</th><th className="px-5 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{invoices.map((invoice) => <tr key={invoice.id} className="hover:bg-slate-50/70"><td className="px-5 py-4 font-semibold text-navy">{invoice.invoice_number}</td><td className="px-5 py-4"><p className="font-medium text-slate-800">{invoice.customer?.full_name || "Customer"}</p><p className="text-xs text-slate-500">{invoice.customer?.email || invoice.customer_id}</p></td><td className="px-5 py-4 text-slate-600">{title(invoice.source_type ?? "other")}</td><td className="px-5 py-4 text-slate-600">{invoice.issued_at ? new Intl.DateTimeFormat("en-ZM",{dateStyle:"medium"}).format(new Date(invoice.issued_at)) : "Draft"}</td><td className="px-5 py-4 font-semibold text-navy">{money(Number(invoice.total_minor),invoice.currency)}</td><td className="px-5 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{title(invoice.status)}</span></td></tr>)}</tbody></table></div>}
    </section>
  </main>
}
