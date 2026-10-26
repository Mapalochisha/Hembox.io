"use client"

import { FormEvent, Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { PortalShell } from "@/components/portal/portal-shell"
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Send } from "lucide-react"

const categories = ["Brand & creative", "Websites & digital experiences", "Apps & software", "Digital infrastructure", "Product & strategy", "Custom work"]
const offerings: Record<string, string[]> = {
  "Brand & creative": ["Brand identity & logo design", "Graphic design & marketing assets", "UI/UX and product design"],
  "Websites & digital experiences": ["Business or campaign website", "E-commerce experience", "Web design and development"],
  "Apps & software": ["Mobile application", "Web application or portal", "Custom software or integration"],
  "Digital infrastructure": ["Domain registration enquiry", "Hosting or maintenance enquiry", "Technical support"],
  "Product & strategy": ["Product discovery and planning", "Prototype or proof of concept", "Technical consulting"],
  "Custom work": ["Custom digital solution", "Multi-service engagement", "Something else"],
}

function RequestForm() {
  const params = useSearchParams()
  const initialCategory = categories.includes(params.get("category") || "") ? params.get("category")! : "Brand & creative"
  const [category, setCategory] = useState(initialCategory)
  const [service, setService] = useState(offerings[initialCategory][0])
  const [brief, setBrief] = useState("")
  const [timing, setTiming] = useState("flexible")
  const [budget, setBudget] = useState("")
  const [reference, setReference] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setSuccess("")
    try {
      const response = await fetch("/api/portal/requests", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify({ category, service, brief, timing, budget, reference }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Your request could not be sent.")
      setSuccess(result.message || "Your request has been sent.")
      setBrief(""); setBudget(""); setReference("")
    } catch (err) { setError(err instanceof Error ? err.message : "Your request could not be sent.") }
    finally { setBusy(false) }
  }

  return <PortalShell title="Request a service">
    <div className="mx-auto max-w-3xl">
      <Link href="/portal/services/catalogue" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-[#16867b]"><ArrowLeft className="h-3.5 w-3.5"/> Back to service catalogue</Link>
      <div className="mt-5"><p className="text-[10px] font-bold tracking-[0.17em] text-[#15877d]">LET&apos;S GET STARTED</p><h2 className="mt-2 text-2xl font-extrabold tracking-tight text-[#172338] sm:text-3xl">Tell us what you have in mind.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Share the outcome you need. The HEMBOX team will review your brief and follow up about scope, timing and pricing. Submitting this form does not confirm a project or quote.</p></div>
      {success && <div role="status" className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700"/><div><p className="text-sm font-bold text-emerald-900">Request submitted</p><p className="mt-1 text-xs leading-5 text-emerald-800">{success}</p><Link href="/portal/messages" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:underline">View messages <ArrowRight className="h-3.5 w-3.5"/></Link></div></div></div>}
      {error && <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      <form onSubmit={submit} className="mt-6 space-y-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block"><span className="text-xs font-bold text-slate-700">What area do you need help with?</span><select value={category} onChange={(event) => { setCategory(event.target.value); setService(offerings[event.target.value][0]) }} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-teal focus:ring-2 focus:ring-teal/20">{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="block"><span className="text-xs font-bold text-slate-700">Service type</span><select value={service} onChange={(event) => setService(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-teal focus:ring-2 focus:ring-teal/20">{offerings[category].map((item) => <option key={item}>{item}</option>)}</select></label>
        </div>
        <label className="block"><span className="text-xs font-bold text-slate-700">Tell us about the project <span className="text-rose-600">*</span></span><textarea required minLength={10} maxLength={4000} rows={6} value={brief} onChange={(event) => setBrief(event.target.value)} placeholder="What are you trying to achieve? Who is it for? Are there any requirements or examples we should know about?" className="mt-2 w-full resize-y rounded-xl border border-slate-200 px-3.5 py-3 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400 focus:border-teal focus:ring-2 focus:ring-teal/20"/><span className="mt-1 block text-right text-[10px] text-slate-400">{brief.length}/4000</span></label>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block"><span className="text-xs font-bold text-slate-700">Preferred timing</span><select value={timing} onChange={(event) => setTiming(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"><option value="flexible">I&apos;m flexible</option><option value="within_month">Within one month</option><option value="urgent">As soon as possible</option></select></label>
          <label className="block"><span className="text-xs font-bold text-slate-700">Indicative budget (optional)</span><input value={budget} onChange={(event) => setBudget(event.target.value)} maxLength={120} placeholder="e.g. Not sure yet, or ZMW 5,000–8,000" className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none placeholder:text-slate-400 focus:border-teal focus:ring-2 focus:ring-teal/20"/></label>
        </div>
        <label className="block"><span className="text-xs font-bold text-slate-700">References or extra context (optional)</span><textarea value={reference} onChange={(event) => setReference(event.target.value)} maxLength={1000} rows={2} placeholder="Links, existing assets, platforms, or anything else we should consider." className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-teal focus:ring-2 focus:ring-teal/20"/></label>
        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-sm text-[11px] leading-5 text-slate-500">Your request is private to your account and the HEMBOX team. No payment is taken by submitting this form.</p><button disabled={busy || brief.trim().length < 10} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#142239] px-5 text-sm font-semibold text-white transition hover:bg-[#203653] disabled:cursor-not-allowed disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4"/>}{busy ? "Sending request…" : "Send service request"}</button></div>
      </form>
    </div>
  </PortalShell>
}

export default function ServiceRequestPage() {
  return <Suspense fallback={<div className="min-h-screen bg-[#f6f8fb]"/>}><RequestForm/></Suspense>
}
