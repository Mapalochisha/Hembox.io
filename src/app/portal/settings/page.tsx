"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useAuth } from "@/components/providers/auth-provider"
import { PortalShell } from "@/components/portal/portal-shell"
import { ArrowRight, Bell, LockKeyhole, Mail, Save, UserRound } from "lucide-react"

type Preferences = { project_updates:boolean; service_updates:boolean; billing_updates:boolean; domain_updates:boolean; message_updates:boolean }
const defaults:Preferences={project_updates:true,service_updates:true,billing_updates:true,domain_updates:true,message_updates:true}
const fields:Array<{key:keyof Preferences;title:string;description:string}>=[
 {key:"project_updates",title:"Project updates",description:"Milestones, deliverables, approvals and change-request decisions."},
 {key:"service_updates",title:"Service updates",description:"Service activation, status changes and renewal reminders."},
 {key:"billing_updates",title:"Billing updates",description:"Invoices, payment claims and verified payment outcomes."},
 {key:"domain_updates",title:"Domain updates",description:"Domain orders, expiry reminders and supported management events."},
 {key:"message_updates",title:"Messages",description:"New replies and requests for information from HEMBOX."},
]
export default function PortalSettingsPage(){
 const {user}=useAuth()
 const [preferences,setPreferences]=useState<Preferences>(defaults)
 const [loading,setLoading]=useState(true)
 const [saving,setSaving]=useState(false)
 const [available,setAvailable]=useState(true)
 const [error,setError]=useState("")
 const [notice,setNotice]=useState("")
 useEffect(()=>{let active=true;void(async()=>{try{const response=await fetch("/api/portal/settings/notifications",{cache:"no-store"});const result=await response.json();if(!response.ok)throw new Error(result.error||"Notification preferences are not available.");if(active){setPreferences(result.preferences);setAvailable(true)}}catch(e){if(active){setAvailable(false);setError(e instanceof Error?e.message:"Notification preferences are not available.")}}finally{if(active)setLoading(false)}})();return()=>{active=false}},[])
 async function save(){setSaving(true);setError("");setNotice("");try{const response=await fetch("/api/portal/settings/notifications",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(preferences)});const result=await response.json();if(!response.ok)throw new Error(result.error||"Unable to save preferences.");setPreferences(result.preferences);setNotice(result.message||"Preferences saved.")}catch(e){setError(e instanceof Error?e.message:"Unable to save preferences.")}finally{setSaving(false)}}
 return <PortalShell title="Account settings">
  <div><p className="text-[10px] font-bold tracking-[0.17em] text-[#15877d]">YOUR ACCOUNT</p><h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">Account settings</h2><p className="mt-2 text-sm text-slate-500">Review your account details and choose the updates you want to receive in your HEMBOX workspace.</p></div>
  {error&&<p role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}{notice&&<p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
  <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
   <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><div className="flex items-center gap-3 border-b border-slate-100 pb-4"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e9f8f5] text-[#16867b]"><UserRound className="h-5 w-5"/></span><div><h3 className="text-sm font-bold text-slate-800">Profile information</h3><p className="mt-1 text-xs text-slate-500">Details associated with your signed-in account.</p></div></div><dl className="mt-4 space-y-4"><div><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Full name</dt><dd className="mt-1 text-sm font-semibold text-slate-800">{user?.full_name||"Not provided"}</dd></div><div><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Email address</dt><dd className="mt-1 break-all text-sm font-semibold text-slate-800">{user?.email||"Not available"}</dd></div><div><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Account type</dt><dd className="mt-1 text-sm font-semibold text-slate-800">HEMBOX client account</dd></div></dl><p className="mt-5 rounded-xl bg-slate-50 p-3 text-[11px] leading-5 text-slate-500">Profile editing and organization membership are not enabled in this workspace yet. Account roles and permissions cannot be changed from this page.</p></section>
   <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><div className="flex items-center gap-3 border-b border-slate-100 pb-4"><span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-700"><Bell className="h-5 w-5"/></span><div><h3 className="text-sm font-bold text-slate-800">Notification preferences</h3><p className="mt-1 text-xs text-slate-500">Choose the workspace updates you want surfaced.</p></div></div>
    {loading?<div className="mt-4 space-y-3"><div className="h-12 animate-pulse rounded-xl bg-slate-100"/><div className="h-12 animate-pulse rounded-xl bg-slate-100"/></div>:<div className="mt-2 divide-y divide-slate-100">{fields.map((field)=><label key={field.key} className={"flex items-start gap-3 py-3 "+(!available?"opacity-50":"")}><input type="checkbox" checked={preferences[field.key]} disabled={!available||saving} onChange={(event)=>setPreferences((current)=>({...current,[field.key]:event.target.checked}))} className="mt-1 h-4 w-4 rounded border-slate-300 accent-teal focus:ring-teal"/><span className="min-w-0 flex-1"><span className="block text-xs font-bold text-slate-800">{field.title}</span><span className="mt-1 block text-[10px] leading-5 text-slate-500">{field.description}</span></span></label>)}</div>}
    <button onClick={()=>void save()} disabled={loading||!available||saving} className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#142239] px-4 text-xs font-semibold text-white hover:bg-[#203653] disabled:cursor-not-allowed disabled:opacity-50"><Save className="h-3.5 w-3.5"/>{saving?"Saving preferences…":"Save preferences"}</button>
    {!available&&<p className="mt-3 text-[10px] leading-5 text-slate-500">Preference storage will become available when the client portal schema migration is applied to this environment.</p>}
   </section>
  </div>
  <div className="mt-4 grid gap-3 sm:grid-cols-2"><section className="rounded-2xl border border-slate-200 bg-white p-5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-700"><LockKeyhole className="h-4 w-4"/></span><h3 className="mt-3 text-sm font-bold text-slate-800">Sign-in & security</h3><p className="mt-1 text-xs leading-5 text-slate-500">Authentication is managed by your HEMBOX sign-in provider.</p><Link href="/login" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#16867b] hover:underline">Sign-in page <ArrowRight className="h-3.5 w-3.5"/></Link></section><section className="rounded-2xl border border-slate-200 bg-white p-5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-amber-700"><Mail className="h-4 w-4"/></span><h3 className="mt-3 text-sm font-bold text-slate-800">Need help?</h3><p className="mt-1 text-xs leading-5 text-slate-500">Contact HEMBOX about your account or an existing service.</p><Link href="/portal/messages" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#16867b] hover:underline">Messages & support <ArrowRight className="h-3.5 w-3.5"/></Link></section></div>
 </PortalShell>
}
