"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { PortalShell } from "@/components/portal/portal-shell"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { ArrowRight, ArrowUpRight, CheckCircle2, Code, Globe, Layers, Palette, Smartphone, Sparkles, Wrench, Loader2 } from "lucide-react"

type Service = { id:string; title:string; description:string|null; icon_name:string|null; slug:string|null; category?:string|null }
const iconMap:Record<string,any>={Globe,Palette,Smartphone,Code,Layers,Wrench}
function ServiceIcon({name}:{name:string|null}) { const Icon=iconMap[name||""]||Sparkles; return <Icon className="h-5 w-5"/> }

export default function ServiceCataloguePage() {
  const [services,setServices]=useState<Service[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState("")
  useEffect(()=>{
    let active=true
    void(async()=>{
      try {
        if(!isSupabaseConfigured()) throw new Error("The service catalogue is temporarily unavailable.")
        const db=createClient()
        const {data,error:queryError}=await db.from("services").select("id,title,description,icon_name,slug,category").eq("status","active").order("sort_order",{ascending:true})
        if(queryError) throw queryError
        if(active) setServices((data||[]) as Service[])
      } catch(e) {
        if(active) setError(e instanceof Error?e.message:"Unable to load the service catalogue.")
      } finally { if(active) setLoading(false) }
    })()
    return()=>{active=false}
  },[])
  return <PortalShell title="Service catalogue">
    <div className="mx-auto max-w-5xl">
      <div className="overflow-hidden rounded-3xl bg-[#111c2e] p-6 text-white sm:p-9">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl"><span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[10px] font-bold tracking-[0.14em] text-teal"><Sparkles className="h-3.5 w-3.5"/> MADE AROUND YOUR GOALS</span>
            <h2 className="mt-5 text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">What can we help you create?</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">Explore Hembox Tech services managed from our live service catalogue. The options shown here stay aligned with the services published on our website.</p>
          </div>
          <Link href="/portal/services/request" className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-teal px-4 text-sm font-bold text-[#102033] transition hover:bg-teal/90">Tell us what you need <ArrowRight className="h-4 w-4"/></Link>
        </div>
      </div>
      <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-bold tracking-[0.17em] text-[#15877d]">OUR CAPABILITIES</p><h3 className="mt-2 text-xl font-extrabold tracking-tight text-[#172338]">Services built around your business</h3></div><p className="max-w-md text-xs leading-5 text-slate-500">Every engagement starts with understanding the brief. Final scope, timing and pricing are confirmed with you before work begins.</p></div>
      {loading?<div className="mt-10 flex items-center justify-center gap-3 py-12 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin"/> Loading published services…</div>
      :error?<p role="alert" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</p>
      :services.length?<div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {services.map(service=><article key={service.id} className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.025)] transition hover:border-slate-300 hover:shadow-sm sm:p-6">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#e9f8f5] text-[#16867b]"><ServiceIcon name={service.icon_name}/></span>
          {service.category&&<p className="mt-4 text-[9px] font-bold uppercase tracking-[0.15em] text-[#15877d]">{service.category}</p>}
          <h4 className="mt-2 text-sm font-bold text-[#172338]">{service.title}</h4><p className="mt-2 min-h-10 flex-1 text-xs leading-5 text-slate-500">{service.description||"A Hembox Tech service tailored to your goals."}</p>
          <Link href={"/portal/services/request?service="+encodeURIComponent(service.title)+"&category="+encodeURIComponent(service.category||"")} className="mt-5 inline-flex items-center gap-1.5 border-t border-slate-100 pt-4 text-xs font-bold text-[#16867b] hover:text-[#105f58]">Request this service <ArrowUpRight className="h-3.5 w-3.5"/></Link>
        </article>)}
      </div>:<div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center"><Sparkles className="mx-auto h-8 w-8 text-[#16867b]"/><h4 className="mt-3 text-sm font-bold text-slate-800">No services are currently published</h4><p className="mt-1 text-xs text-slate-500">Please check back later or contact our team.</p></div>}
      <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><p className="text-sm font-bold text-slate-800">Not sure where to start?</p><p className="mt-1 text-xs text-slate-500">Describe the outcome you need. We can help work out the right approach.</p></div><Link href="/portal/services/request" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#142239] px-4 text-xs font-semibold text-white hover:bg-[#203653]">Request custom quote <ArrowRight className="h-3.5 w-3.5"/></Link></div>
    </div>
  </PortalShell>
}
