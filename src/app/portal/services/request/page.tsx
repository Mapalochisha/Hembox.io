"use client"

import { FormEvent, Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { PortalShell } from "@/components/portal/portal-shell"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Send } from "lucide-react"

type Service={id:string;title:string;description:string|null}
function RequestForm() {
  const params=useSearchParams()
  const requestedService=params.get("service")||""
  const [services,setServices]=useState<Service[]>([])
  const [service,setService]=useState(requestedService)
  const [servicesLoading,setServicesLoading]=useState(true)
  const [brief,setBrief]=useState("")
  const [timing,setTiming]=useState("flexible")
  const [budget,setBudget]=useState("")
  const [budgetCurrency,setBudgetCurrency]=useState("ZMW")
  const [reference,setReference]=useState("")
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState("")
  const [success,setSuccess]=useState("")
  useEffect(()=>{
    let active=true
    void(async()=>{
      try {
        if(!isSupabaseConfigured()) return
        const db=createClient()
        const {data,error:queryError}=await db.from("services").select("id,title,description").eq("status","active").order("sort_order",{ascending:true})
        if(queryError) throw queryError
        if(active){const rows=(data||[]) as Service[];setServices(rows);if(!requestedService&&rows[0])setService(rows[0].title)}
      } catch(e){if(active)setError(e instanceof Error?e.message:"Unable to load published services.")}
      finally{if(active)setServicesLoading(false)}
    })()
    return()=>{active=false}
  },[requestedService])
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError("");setSuccess("")
    const selected=services.find(item=>item.title===service)
    try{
      const response=await fetch("/api/portal/requests",{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",body:JSON.stringify({category:selected?"Published service":"Custom enquiry",service:service||"General enquiry",brief,timing,budget,budgetCurrency,reference})})
      const result=await response.json()
      if(!response.ok)throw new Error(result.error||"Your request could not be sent.")
      setSuccess(result.message||"Your request has been sent.");setBrief("");setBudget("");setReference("")
    }catch(err){setError(err instanceof Error?err.message:"Your request could not be sent.")}
    finally{setBusy(false)}
  }
  return <PortalShell title="Request a service">
    <div className="mx-auto max-w-3xl">
      <Link href="/portal/services/catalogue" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-[#16867b]"><ArrowLeft className="h-3.5 w-3.5"/> Back to service catalogue</Link>
      <div className="mt-5"><p className="text-[10px] font-bold tracking-[0.17em] text-[#15877d]">LET&apos;S GET STARTED</p><h2 className="mt-2 text-2xl font-extrabold tracking-tight text-[#172338] sm:text-3xl">Tell us what you have in mind.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Choose from the services currently published by Hembox Tech, or describe a custom requirement. The team will review your brief and follow up about scope, timing and pricing.</p></div>
      {success&&<div role="status" className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700"/><div><p className="text-sm font-bold text-emerald-900">Request submitted</p><p className="mt-1 text-xs leading-5 text-emerald-800">{success}</p><Link href="/portal/messages" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:underline">View messages <ArrowRight className="h-3.5 w-3.5"/></Link></div></div></div>}
      {error&&<p role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
      <form onSubmit={submit} className="mt-6 space-y-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7">
        <label className="block"><span className="text-xs font-bold text-slate-700">Service</span><select value={service} onChange={event=>setService(event.target.value)} disabled={servicesLoading} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"><option value="">Custom / not sure yet</option>{services.map(item=><option key={item.id} value={item.title}>{item.title}</option>)}</select>{servicesLoading&&<span className="mt-1 block text-[10px] text-slate-400">Loading published services…</span>}</label>
        {service&&services.find(item=>item.title===service)?.description&&<p className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">{services.find(item=>item.title===service)?.description}</p>}
        <label className="block"><span className="text-xs font-bold text-slate-700">Tell us about the project <span className="text-rose-600">*</span></span><textarea required minLength={10} maxLength={4000} rows={6} value={brief} onChange={event=>setBrief(event.target.value)} placeholder="What are you trying to achieve? Who is it for? Are there any requirements or examples we should know about?" className="mt-2 w-full resize-y rounded-xl border border-slate-200 px-3.5 py-3 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400 focus:border-teal focus:ring-2 focus:ring-teal/20"/><span className="mt-1 block text-right text-[10px] text-slate-400">{brief.length}/4000</span></label>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block"><span className="text-xs font-bold text-slate-700">Preferred timing</span><select value={timing} onChange={event=>setTiming(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"><option value="flexible">I&apos;m flexible</option><option value="within_month">Within one month</option><option value="urgent">As soon as possible</option></select></label>
          <div><span className="text-xs font-bold text-slate-700">Indicative budget (optional)</span><div className="mt-2 flex gap-2"><select aria-label="Budget currency" value={budgetCurrency} onChange={event=>setBudgetCurrency(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal"><option value="ZMW">ZMW</option><option value="USD">USD</option></select><input value={budget} onChange={event=>setBudget(event.target.value)} maxLength={120} placeholder="e.g. 5,000–8,000 or not sure" className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm outline-none placeholder:text-slate-400 focus:border-teal focus:ring-2 focus:ring-teal/20"/></div></div>
        </div>
        <label className="block"><span className="text-xs font-bold text-slate-700">References or extra context (optional)</span><textarea value={reference} onChange={event=>setReference(event.target.value)} maxLength={1000} rows={2} placeholder="Links, existing assets, platforms, or anything else we should consider." className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-teal focus:ring-2 focus:ring-teal/20"/></label>
        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-sm text-[11px] leading-5 text-slate-500">Your request is private to your account and the Hembox Tech team. No payment is taken by submitting this form.</p><button disabled={busy||brief.trim().length<10} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#142239] px-5 text-sm font-semibold text-white transition hover:bg-[#203653] disabled:cursor-not-allowed disabled:opacity-50">{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<Send className="h-4 w-4"/>}{busy?"Sending request…":"Send service request"}</button></div>
      </form>
    </div>
  </PortalShell>
}
export default function ServiceRequestPage(){return <Suspense fallback={<div className="min-h-screen bg-[#f6f8fb]"/>}><RequestForm/></Suspense>}
