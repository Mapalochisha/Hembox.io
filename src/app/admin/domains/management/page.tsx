"use client"

import { useCallback, useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"

type RequestRow = {
  id: string; order_id: string; customer_id: string; request_type: string
  requested_years: number | null; requested_nameservers: string[] | null
  status: string; customer_note: string | null; admin_note: string | null; created_at: string
  domain_orders: { id: string; domain_name: string; status: string; expires_at: string | null; nameservers: string[] | null }
}

export default function AdminDomainManagementPage() {
  const [requests,setRequests]=useState<RequestRow[]>([])
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState("")
  const [note,setNote]=useState<Record<string,string>>({})
  const [error,setError]=useState("")
  const [notice,setNotice]=useState("")
  const load=useCallback(async()=>{const response=await fetch("/api/admin/domains/management",{cache:"no-store"});const body=await response.json();if(!response.ok)throw new Error(body.error??"Management queue unavailable.");setRequests(body.requests??[])},[])
  useEffect(()=>{load().catch(e=>setError(e instanceof Error?e.message:"Could not load requests.")).finally(()=>setLoading(false))},[load])
  async function act(requestId:string,action:"apply"|"reject"){
    setBusy(requestId);setError("");setNotice("")
    try{const response=await fetch("/api/admin/domains/management",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({requestId,action,adminNote:note[requestId]??""})});const body=await response.json();if(!response.ok&&response.status!==202)throw new Error(body.error??"Could not update request.");setNotice(response.status===202?body.error??"Provider reconciliation is required; do not retry.":action==="apply"?"Registrar change confirmed and recorded.":"Request rejected.");await load()}catch(e){setError(e instanceof Error?e.message:"Action failed.")}finally{setBusy("")}
  }
  return <div className="space-y-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-teal">Domain operations</p><h1 className="mt-1 text-3xl font-black text-navy">Management requests</h1><p className="mt-2 text-sm text-slate-500">Apply changes only through NameSilo OTE. Each operation is read back before the request is marked applied.</p></div><button onClick={()=>{setLoading(true);load().catch(e=>setError(e instanceof Error?e.message:"Refresh failed.")).finally(()=>setLoading(false))}} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold"><RefreshCw className="h-4 w-4"/>Refresh</button></div>
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Live registrar mutations are disabled. Ambiguous OTE results require reconciliation; never retry a renewal or nameserver change blindly.</div>
    {error?<p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>:null}{notice?<p role="status" className="rounded-xl bg-teal/10 p-3 text-sm text-slate-800">{notice}</p>:null}
    {loading?<p className="rounded-xl bg-white p-8 text-center text-sm text-slate-500">Loading requests…</p>:requests.length===0?<p className="rounded-xl bg-white p-8 text-center text-sm text-slate-500">No management requests.</p>:<div className="space-y-4">{requests.map(item=><section key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-lg font-black text-navy">{item.domain_orders.domain_name}</p><p className="mt-1 text-xs text-slate-500">{item.request_type==="renewal"?`Renew ${item.requested_years} year(s)`:`Nameservers: ${item.requested_nameservers?.join(", ")}`}</p><p className="mt-1 text-xs text-slate-400">Customer {item.customer_id} · {new Date(item.created_at).toLocaleString()}</p></div><span className="self-start rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{item.status}</span></div>{item.customer_note?<p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Customer note: {item.customer_note}</p>:null}{item.status==="requested"?<><label className="mt-4 block text-xs font-bold text-slate-600">Admin note<textarea rows={2} value={note[item.id]??""} onChange={e=>setNote(current=>({...current,[item.id]:e.target.value}))} maxLength={1000} className="mt-1 w-full rounded-lg border border-slate-200 p-3 text-sm font-normal"/></label><div className="mt-3 flex flex-wrap gap-2"><button onClick={()=>void act(item.id,"apply")} disabled={busy===item.id} className="rounded-lg bg-navy px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy===item.id?"Working…":"Apply in OTE"}</button><button onClick={()=>void act(item.id,"reject")} disabled={busy===item.id} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50">Reject</button></div></>:null}</section>)}</div>}
  </div>
}
