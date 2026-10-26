"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { PortalShell } from "@/components/portal/portal-shell"
import { Bell, CheckCheck, CircleDollarSign, FolderKanban, Globe2, MessageSquare, RefreshCw, Sparkles } from "lucide-react"

type Notification = { id:string; category:string; title:string; body:string; href:string|null; read_at:string|null; created_at:string }
const icons:Record<string,typeof Bell>={project:FolderKanban,service:Sparkles,billing:CircleDollarSign,domain:Globe2,message:MessageSquare,system:Bell}
function date(value:string){const parsed=new Date(value);return Number.isNaN(parsed.getTime())?"Date unavailable":parsed.toLocaleString("en-ZM",{dateStyle:"medium",timeStyle:"short"})}

export default function PortalNotificationsPage(){
 const [notifications,setNotifications]=useState<Notification[]>([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState("")
 const [notice,setNotice]=useState("")
 async function load(){setLoading(true);setError("");try{const response=await fetch("/api/portal/notifications",{cache:"no-store"});const result=await response.json();if(!response.ok)throw new Error(result.error||"Notifications are unavailable.");setNotifications(result.notifications??[])}catch(e){setError(e instanceof Error?e.message:"Notifications are unavailable.")}finally{setLoading(false)}}
 useEffect(()=>{void load()},[])
 async function markRead(id?:string){setError("");setNotice("");try{const response=await fetch("/api/portal/notifications",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(id?{notificationId:id}:{markAllRead:true})});const result=await response.json();if(!response.ok)throw new Error(result.error||"Could not update notifications.");setNotifications((rows)=>rows.map((row)=>!id||row.id===id?{...row,read_at:row.read_at||new Date().toISOString()}:row));setNotice("Notifications marked as read.")}catch(e){setError(e instanceof Error?e.message:"Could not update notifications.")}}
 const unread=notifications.filter((item)=>!item.read_at).length
 return <PortalShell title="Notifications">
  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-bold tracking-[0.17em] text-[#15877d]">WORKSPACE UPDATES</p><h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">Notifications</h2><p className="mt-2 text-sm text-slate-500">Important updates about your projects, services, billing and messages.</p></div><div className="flex gap-2"><button onClick={()=>void load()} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"><RefreshCw className="h-3.5 w-3.5"/> Refresh</button>{unread>0&&<button onClick={()=>void markRead()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#142239] px-3 text-xs font-semibold text-white hover:bg-[#203653]"><CheckCheck className="h-3.5 w-3.5"/> Mark all read</button>}</div></div>
  {error&&<p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}{notice&&<p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
  <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
   {loading?<div className="space-y-3 p-5"><div className="h-16 animate-pulse rounded-xl bg-slate-100"/><div className="h-16 animate-pulse rounded-xl bg-slate-100"/></div>:notifications.length?notifications.map((item)=>{const Icon=icons[item.category]||Bell;const content=<div className={"flex items-start gap-3 p-4 sm:p-5 "+(!item.read_at?"bg-[#f0faf8]":"")}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#16867b] ring-1 ring-inset ring-slate-200"><Icon className="h-4 w-4"/></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold text-slate-800">{item.title}</span>{!item.read_at&&<span className="rounded-full bg-teal/10 px-2 py-0.5 text-[9px] font-bold text-[#16867b]">New</span>}</span><span className="mt-1.5 block whitespace-pre-wrap text-xs leading-5 text-slate-600">{item.body}</span><span className="mt-2 block text-[10px] text-slate-400">{date(item.created_at)}</span></span></div>;return <div key={item.id} className="flex items-stretch border-b border-slate-100 last:border-b-0"><div className="min-w-0 flex-1">{item.href?<Link href={item.href} onClick={()=>{if(!item.read_at)void markRead(item.id)}} className="block transition hover:bg-slate-50/70">{content}</Link>:content}</div>{!item.read_at&&<button onClick={()=>void markRead(item.id)} aria-label={"Mark "+item.title+" as read"} className="mr-3 self-center shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[10px] font-semibold text-slate-600 hover:bg-slate-50">Mark read</button>}</div>}):<div className="px-6 py-14 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-500"><Bell className="h-5 w-5"/></span><h3 className="mt-4 text-sm font-bold text-slate-800">No notifications yet</h3><p className="mx-auto mt-2 max-w-md text-xs leading-5 text-slate-500">When HEMBOX records a project update, payment event or important service notice, it will appear here.</p><Link href="/portal" className="mt-4 inline-flex text-xs font-bold text-[#16867b] hover:underline">Back to overview</Link></div>}
  </section>
 </PortalShell>
}
