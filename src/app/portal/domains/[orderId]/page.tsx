"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react"
import { PortalShell } from "@/components/portal/portal-shell"

type Order = { id: string; domain_name: string; status: string; expires_at: string | null; nameservers: string[] | null; nameservers_updated_at: string | null }
type ManagementRequest = { id: string; request_type: string; requested_years: number | null; requested_nameservers: string[] | null; status: string; customer_note: string | null; admin_note: string | null; created_at: string; applied_at: string | null }

export default function ManageDomainPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const [order,setOrder]=useState<Order|null>(null)
  const [requests,setRequests]=useState<ManagementRequest[]>([])
  const [years,setYears]=useState(1)
  const [nameservers,setNameservers]=useState("ns1.example.com\nns2.example.com")
  const [note,setNote]=useState("")
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState("")
  const [notice,setNotice]=useState("")

  const load=useCallback(async()=>{
    const ordersResponse=await fetch("/api/domains/orders",{cache:"no-store"})
    const ordersBody=await ordersResponse.json()
    if(!ordersResponse.ok)throw new Error(ordersBody.error??"Could not load your domains.")
    const found=(ordersBody.orders??[]).find((item:Order)=>item.id===orderId)
    if(!found)throw new Error("Domain order not found in your account.")
    setOrder(found)
    const response=await fetch(`/api/domains/management?orderId=${encodeURIComponent(orderId)}`,{cache:"no-store"})
    const body=await response.json()
    if(!response.ok)throw new Error(body.error??"Domain management is unavailable.")
    setOrder(body.order)
    setRequests(body.requests??[])
    if(body.order.nameservers?.length) setNameservers(body.order.nameservers.join("\n"))
  },[orderId])

  useEffect(()=>{load().catch(e=>setError(e instanceof Error?e.message:"Could not load domain.")).finally(()=>setLoading(false))},[load])

  async function submit(requestType:"renewal"|"nameservers"){
    setBusy(true);setError("");setNotice("")
    try{
      const response=await fetch("/api/domains/management",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        orderId,requestType,
        ...(requestType==="renewal"?{requestedYears:years}:{requestedNameservers:nameservers.split(/[\n,]+/).map(value=>value.trim()).filter(Boolean)}),
        customerNote:note,idempotencyKey:crypto.randomUUID(),
      })})
      const body=await response.json()
      if(!response.ok)throw new Error(body.error??"Could not submit management request.")
      setNotice("Your request has been sent to HEMBOX for review.")
      setNote("")
      await load()
    }catch(e){setError(e instanceof Error?e.message:"Could not submit request.")}
    finally{setBusy(false)}
  }

  return <PortalShell title="Manage domain"><main className="mx-auto max-w-5xl px-0 pb-8">
    <Link href="/portal/domains" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-teal"><ArrowLeft className="h-4 w-4"/>Back to domains</Link>
    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-teal">Domain ownership</p><h1 className="mt-1 text-3xl font-black text-navy">Manage domain</h1><p className="mt-2 text-sm text-slate-500">Renewal and nameserver changes are reviewed and recorded by HEMBOX.</p></div><button onClick={()=>{setLoading(true);load().catch(e=>setError(e instanceof Error?e.message:"Refresh failed.")).finally(()=>setLoading(false))}} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold"><RefreshCw className="h-4 w-4"/>Refresh</button></div>
    {error?<p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>:null}{notice?<p role="status" className="mt-5 rounded-xl bg-teal/10 p-3 text-sm text-slate-800">{notice}</p>:null}
    {loading?<div className="mt-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin"/></div>:order?<><section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-2xl font-black text-navy">{order.domain_name}</h2><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Status</p><p className="mt-1 font-bold">{order.status}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Expiry</p><p className="mt-1 font-bold">{order.expires_at?new Date(order.expires_at).toLocaleDateString():"Not recorded"}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Nameservers</p><p className="mt-1 break-all text-sm font-semibold">{order.nameservers?.join(", ")||"Not recorded"}</p></div></div></section>
    {order.status==="registered"?<section className="mt-5 grid gap-5 md:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-black">Request a renewal</h2><p className="mt-1 text-sm text-slate-500">This creates a request; it does not charge you or extend the domain until the registrar operation is confirmed.</p><label className="mt-4 block text-sm font-semibold">Years<select value={years} onChange={e=>setYears(Number(e.target.value))} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3">{Array.from({length:10},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></label><button onClick={()=>void submit("renewal")} disabled={busy} className="mt-4 h-11 w-full rounded-xl bg-navy text-sm font-bold text-white disabled:opacity-50">{busy?"Submitting…":"Request renewal"}</button></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-black">Change nameservers</h2><p className="mt-1 text-sm text-slate-500">Enter 2–8 unique hostnames, one per line. The change is not applied until confirmed by the registrar.</p><textarea value={nameservers} onChange={e=>setNameservers(e.target.value)} rows={4} className="mt-4 w-full rounded-xl border border-slate-200 p-3 text-sm"/><button onClick={()=>void submit("nameservers")} disabled={busy} className="mt-4 h-11 w-full rounded-xl bg-navy text-sm font-bold text-white disabled:opacity-50">{busy?"Submitting…":"Request nameserver change"}</button></div></section>:<p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">This order is not yet registered, so post-purchase management is unavailable.</p>}
    <label className="mt-5 block rounded-2xl border border-slate-200 bg-white p-5 text-sm font-semibold">Note for HEMBOX (optional)<textarea value={note} onChange={e=>setNote(e.target.value)} rows={3} maxLength={500} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal" placeholder="Add any instructions or context…"/></label>
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-black text-navy">Request history</h2>{requests.length===0?<p className="mt-3 text-sm text-slate-500">No management requests yet.</p>:<div className="mt-3 divide-y divide-slate-100">{requests.map(item=><div key={item.id} className="py-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold capitalize">{item.request_type}</p><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{item.status}</span></div><p className="mt-1 text-xs text-slate-500">{new Date(item.created_at).toLocaleString()} · {item.request_type==="renewal"?`${item.requested_years} year(s)`:item.requested_nameservers?.join(", ")}</p>{item.admin_note?<p className="mt-1 text-sm text-slate-600">{item.admin_note}</p>:null}</div>)}</div>}</section>
    </>:null}
  </main></PortalShell>
}
