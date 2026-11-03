"use client"

import { useCallback, useEffect, useState } from "react"
import { RefreshCw, RotateCcw, ShieldCheck } from "lucide-react"

type SandboxOrder = {
  id: string; customer_id: string; domain_name: string; term_years: number; status: string
  payment_mode: string; payment_status: string; test_payment_reference: string | null
  test_payment_submitted_at: string | null; test_payment_reviewed_at: string | null
  test_payment_admin_note: string | null; provider_environment: string
  provider_code: number | null; provider_order_amount: string | null
  registered_at: string | null; expires_at: string | null; nameservers: string[]
  last_provider_check_at: string | null; last_provider_message: string | null; created_at: string
}
type Action = "approve_payment" | "reject_payment" | "reconcile" | "reset_if_unregistered"
type ManagementRequest = { id:string; order_id:string; customer_id:string; request_type:"renewal"|"nameservers"; requested_years:number|null; requested_nameservers:string[]|null; customer_note:string|null; status:string; admin_note:string|null; created_at:string; domain_sandbox_orders:{domain_name:string} }

export default function AdminDomainSandboxPage() {
  const [orders,setOrders]=useState<SandboxOrder[]>([])
  const [management,setManagement]=useState<ManagementRequest[]>([])
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState("")
  const [notes,setNotes]=useState<Record<string,string>>({})
  const [error,setError]=useState("")
  const [notice,setNotice]=useState("")
  const load=useCallback(async()=>{
    const response=await fetch("/api/admin/domains/sandbox",{cache:"no-store"})
    const body=await response.json()
    if(!response.ok)throw new Error(body.error??"Sandbox queue unavailable.")
    setOrders(body.orders??[])
    const queueResponse=await fetch("/api/admin/domains/sandbox/management",{cache:"no-store"})
    const queueBody=await queueResponse.json()
    if(!queueResponse.ok)throw new Error(queueBody.error??"Management queue unavailable.")
    setManagement(queueBody.requests??[])
  },[])
  useEffect(()=>{load().catch(e=>setError(e instanceof Error?e.message:"Could not load queue.")).finally(()=>setLoading(false))},[load])

  async function act(orderId:string,action:Action){
    setBusy(orderId);setError("");setNotice("")
    try{
      const response=await fetch("/api/admin/domains/sandbox",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action,orderId,adminNote:notes[orderId]??""}),
      })
      const body=await response.json()
      if(response.status>=500||response.status===401||response.status===403||response.status===400)throw new Error(body.error??"Sandbox action failed.")
      setNotice(body.message??body.error??(body.registered?"OTE registration confirmed.":body.reconciled?"OTE state reconciled.":"Sandbox action processed."))
      await load()
    }catch(e){setError(e instanceof Error?e.message:"Sandbox action failed.")}
    finally{setBusy("")}
  }

  async function manageRequest(requestId:string,action:"apply"|"reject"|"reconcile"){
    setBusy(requestId);setError("");setNotice("")
    try{
      const response=await fetch("/api/admin/domains/sandbox/management",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({requestId,action})})
      const body=await response.json()
      if(!response.ok&&response.status!==202)throw new Error(body.error??"Management action failed.")
      setNotice(body.error??(action==="reject"?"Request rejected.":body.success?"Registrar change confirmed and saved.":"Request requires read-only reconciliation."))
      await load()
    }catch(e){setError(e instanceof Error?e.message:"Management action failed.")}
    finally{setBusy("")}
  }
  const date=(v:string|null)=>v?new Date(v).toLocaleString():"—"
  return <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-wider text-teal">Provider: NameSilo OTE · No live operations</p><h1 className="mt-1 text-3xl font-black text-navy">Sandbox domain operations</h1><p className="mt-2 text-sm text-slate-500">Review test-payment references, approve or reject them, and reconcile registrar outcomes.</p></div>
      <button onClick={()=>{setLoading(true);load().catch(e=>setError(e instanceof Error?e.message:"Refresh failed.")).finally(()=>setLoading(false))}} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold"><RefreshCw className="h-4 w-4"/>Refresh</button>
    </div>
    <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><ShieldCheck className="h-5 w-5 shrink-0"/><p>Sandbox payments are zero-value test acknowledgements, not invoices or verified funds. The HEMBOX retail TLD price catalogue is currently empty. Approval calls NameSilo OTE only; it never enables live registration.</p></div>
    {error?<p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>:null}
    {notice?<p role="status" className="rounded-xl bg-teal/10 p-3 text-sm text-slate-800">{notice}</p>:null}
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-5"><h2 className="text-xl font-black text-navy">Customer domain-management requests</h2><p className="mt-1 text-sm text-slate-500">Approve or reject renewal and nameserver requests. Ambiguous outcomes can only be reconciled; they cannot be blindly re-applied.</p></div>
      {management.length===0?<p className="p-5 text-sm text-slate-500">No management requests.</p>:<div className="divide-y divide-slate-100">{management.map(item=><div key={item.id} className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div><p className="font-bold text-navy">{item.domain_sandbox_orders?.domain_name??item.order_id} · {item.request_type==="renewal"?`Renewal (${item.requested_years} year(s))`:"Nameserver change"}</p>
          {item.requested_nameservers?.length?<p className="mt-1 break-all text-xs text-slate-500">{item.requested_nameservers.join(", ")}</p>:null}
          {item.customer_note?<p className="mt-1 text-xs text-slate-500">Customer note: {item.customer_note}</p>:null}
          {item.admin_note?<p className="mt-1 text-xs text-slate-500">Admin note: {item.admin_note}</p>:null}
          <p className="mt-1 text-xs text-slate-400">{date(item.created_at)} · {item.status}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {item.status==="requested"?<><button onClick={()=>void manageRequest(item.id,"apply")} disabled={!!busy} className="rounded-lg bg-navy px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Approve & apply in OTE</button><button onClick={()=>void manageRequest(item.id,"reject")} disabled={!!busy} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold disabled:opacity-50">Reject</button></>:null}
          {item.status==="unknown"?<button onClick={()=>void manageRequest(item.id,"reconcile")} disabled={!!busy} className="rounded-lg bg-amber-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Reconcile OTE (read-only)</button>:null}
        </div>
      </div>)}</div>}
    </section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="overflow-x-auto"><table className="w-full min-w-[1250px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Domain / order</th><th className="px-4 py-3">Customer ID</th><th className="px-4 py-3">Order state</th><th className="px-4 py-3">Test payment</th><th className="px-4 py-3">Expiry</th><th className="px-4 py-3">Provider state</th><th className="px-4 py-3">Admin action</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{orders.map(order=><tr key={order.id} className="align-top">
          <td className="px-4 py-4"><p className="font-bold text-navy">{order.domain_name}</p><p className="mt-1 text-xs text-slate-400">{order.id}</p></td>
          <td className="px-4 py-4 text-xs text-slate-500">{order.customer_id}</td>
          <td className="px-4 py-4"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{order.status.replaceAll("_"," ")}</span><p className="mt-2 text-xs text-slate-500">{order.term_years} year(s) · OTE</p></td>
          <td className="px-4 py-4 text-xs"><p className="font-bold">{order.payment_status.replaceAll("_"," ")}</p><p className="mt-1 break-all text-slate-500">{order.test_payment_reference??"No reference submitted"}</p><p className="mt-1 text-slate-400">{date(order.test_payment_submitted_at)}</p></td>
          <td className="px-4 py-4 text-xs">{date(order.expires_at)}</td>
          <td className="max-w-xs px-4 py-4 text-xs text-slate-500">{order.last_provider_message??"No provider response recorded"}<p className="mt-1 text-slate-400">{date(order.last_provider_check_at)}</p></td>
          <td className="px-4 py-4">
            {order.status==="payment_pending"&&order.payment_status==="submitted"?<div className="space-y-2"><textarea value={notes[order.id]??""} onChange={e=>setNotes(v=>({...v,[order.id]:e.target.value}))} rows={2} maxLength={1000} placeholder="Admin note (optional)" className="w-52 rounded-lg border border-slate-200 p-2 text-xs"/><div className="flex flex-wrap gap-2"><button onClick={()=>void act(order.id,"approve_payment")} disabled={busy===order.id} className="rounded-lg bg-navy px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busy===order.id?"Working…":"Approve & register"}</button><button onClick={()=>void act(order.id,"reject_payment")} disabled={busy===order.id} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold disabled:opacity-50">Reject</button></div></div>:null}
            {["registration_pending","registration_unknown"].includes(order.status)?<button onClick={()=>void act(order.id,"reconcile")} disabled={busy===order.id} className="inline-flex items-center gap-2 rounded-lg bg-navy px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busy===order.id?<RefreshCw className="h-3 w-3 animate-spin"/>:<RotateCcw className="h-3 w-3"/>}Reconcile OTE</button>:null}
            {["registration_pending","registration_unknown","registration_failed"].includes(order.status)?<button onClick={()=>void act(order.id,"reset_if_unregistered")} disabled={busy===order.id} className="mt-2 block rounded-lg border border-amber-300 px-3 py-2 text-xs font-bold text-amber-900 disabled:opacity-50">Safe retry check</button>:null}
            {!["payment_pending","registration_pending","registration_unknown","registration_failed"].includes(order.status)?<span className="text-xs text-slate-400">No action</span>:null}
          </td>
        </tr>)}</tbody>
      </table></div>
      {!loading&&orders.length===0?<p className="p-10 text-center text-sm text-slate-500">No sandbox orders have been placed yet.</p>:null}
      {loading?<p className="p-10 text-center text-sm text-slate-500">Loading sandbox queue…</p>:null}
    </section>
  </div>
}
