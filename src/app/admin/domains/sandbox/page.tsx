"use client"

import { useCallback, useEffect, useState } from "react"
import { RefreshCw, RotateCcw, ShieldCheck } from "lucide-react"

type SandboxOrder = {
  id: string; customer_id: string; domain_name: string; term_years: number; status: string
  payment_mode: string; payment_status: string; provider_environment: string
  provider_code: number | null; provider_order_amount: string | null
  registered_at: string | null; expires_at: string | null; nameservers: string[]
  last_provider_check_at: string | null; last_provider_message: string | null; created_at: string
}

export default function AdminDomainSandboxPage() {
  const [orders,setOrders]=useState<SandboxOrder[]>([])
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState("")
  const [error,setError]=useState("")
  const [notice,setNotice]=useState("")
  const load=useCallback(async()=>{const response=await fetch("/api/admin/domains/sandbox",{cache:"no-store"});const body=await response.json();if(!response.ok)throw new Error(body.error??"Sandbox queue unavailable.");setOrders(body.orders??[])},[])
  useEffect(()=>{load().catch(e=>setError(e instanceof Error?e.message:"Could not load queue.")).finally(()=>setLoading(false))},[load])
  async function reconcile(orderId:string){setBusy(orderId);setError("");setNotice("");try{const response=await fetch("/api/admin/domains/sandbox",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"reconcile",orderId})});const body=await response.json();if(!response.ok&&response.status!==202)throw new Error(body.error??"Reconciliation failed.");setNotice(body.reconciled?"OTE state confirmed and the sandbox order was updated.":body.message??"OTE still has not confirmed the registration.");await load()}catch(e){setError(e instanceof Error?e.message:"Reconciliation failed.")}finally{setBusy("")}}
  const date=(v:string|null)=>v?new Date(v).toLocaleString():"—"
  return <div className="space-y-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-teal">Provider: NameSilo OTE · No live operations</p><h1 className="mt-1 text-3xl font-black text-navy">Sandbox domain operations</h1><p className="mt-2 text-sm text-slate-500">Review customer test purchases, inspect provider acknowledgements and reconcile uncertain registrations.</p></div><button onClick={()=>{setLoading(true);load().catch(e=>setError(e instanceof Error?e.message:"Refresh failed.")).finally(()=>setLoading(false))}} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold"><RefreshCw className="h-4 w-4"/>Refresh</button></div>
  <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><ShieldCheck className="h-5 w-5 shrink-0"/><p>These are isolated OTE test records. Simulated HEMBOX payments are not invoices or verified funds. Do not use this queue to fulfil live domain orders.</p></div>
  {error?<p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>:null}{notice?<p role="status" className="rounded-xl bg-teal/10 p-3 text-sm text-slate-800">{notice}</p>:null}
  <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Domain / order</th><th className="px-4 py-3">Customer ID</th><th className="px-4 py-3">Order state</th><th className="px-4 py-3">Sandbox payment</th><th className="px-4 py-3">Expiry</th><th className="px-4 py-3">Provider check</th><th className="px-4 py-3">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{orders.map(order=><tr key={order.id} className="align-top"><td className="px-4 py-4"><p className="font-bold text-navy">{order.domain_name}</p><p className="mt-1 text-xs text-slate-400">{order.id}</p></td><td className="px-4 py-4 text-xs text-slate-500">{order.customer_id}</td><td className="px-4 py-4"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{order.status.replaceAll("_"," ")}</span><p className="mt-2 text-xs text-slate-500">{order.term_years} year(s) · OTE</p></td><td className="px-4 py-4 text-xs">K0.00 simulated<br/>{order.payment_status}</td><td className="px-4 py-4 text-xs">{date(order.expires_at)}</td><td className="max-w-xs px-4 py-4 text-xs text-slate-500">{order.last_provider_message??"No provider response recorded"}<p className="mt-1 text-slate-400">{date(order.last_provider_check_at)}</p></td><td className="px-4 py-4">{["registration_pending","registration_unknown"].includes(order.status)?<button onClick={()=>void reconcile(order.id)} disabled={busy===order.id} className="inline-flex items-center gap-2 rounded-lg bg-navy px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busy===order.id?<RefreshCw className="h-3 w-3 animate-spin"/>:<RotateCcw className="h-3 w-3"/>}Reconcile OTE</button>:<span className="text-xs text-slate-400">No action</span>}</td></tr>)}</tbody></table></div>{!loading&&orders.length===0?<p className="p-10 text-center text-sm text-slate-500">No sandbox orders have been placed yet.</p>:null}{loading?<p className="p-10 text-center text-sm text-slate-500">Loading sandbox queue…</p>:null}</section>
  </div>
}
