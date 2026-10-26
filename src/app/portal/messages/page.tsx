"use client"

import { FormEvent, useEffect, useState } from "react"
import Link from "next/link"
import { PortalShell } from "@/components/portal/portal-shell"
import { ArrowUpRight, Loader2, MessageSquare, RefreshCw, Send } from "lucide-react"

type Message = { id: string; inquiry_id: string; sender_role: "customer" | "admin"; body: string; created_at: string }
type Thread = { id: string; type: string; status: string; source: string | null; message: string | null; created_at: string; updated_at: string; messages: Message[] }
function date(value: string) { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? "Date unavailable" : parsed.toLocaleString("en-ZM",{dateStyle:"medium",timeStyle:"short"}) }

export default function ClientMessagesPage() {
  const [threads,setThreads] = useState<Thread[]>([])
  const [selected,setSelected] = useState("")
  const [draft,setDraft] = useState("")
  const [loading,setLoading] = useState(true)
  const [sending,setSending] = useState(false)
  const [error,setError] = useState("")
  const [notice,setNotice] = useState("")
  async function load(preferred?: string) {
    setLoading(true); setError("")
    try { const response=await fetch("/api/portal/messages",{cache:"no-store"}); const result=await response.json(); if(!response.ok) throw new Error(result.error||"Messages are unavailable."); const rows=(result.threads??[]) as Thread[]; setThreads(rows); setSelected((current)=>preferred&&rows.some((row)=>row.id===preferred)?preferred:rows.some((row)=>row.id===current)?current:rows[0]?.id??"") }
    catch(e){setError(e instanceof Error?e.message:"Messages are unavailable.")} finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[])
  const active=threads.find((thread)=>thread.id===selected)
  async function send(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(!active||!draft.trim())return
    setSending(true);setError("");setNotice("")
    try { const response=await fetch("/api/portal/messages",{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",body:JSON.stringify({conversationId:active.id,body:draft.trim()})});const result=await response.json();if(!response.ok)throw new Error(result.error||"Message could not be sent.");setDraft("");setNotice("Message sent.");await load(active.id) }
    catch(e){setError(e instanceof Error?e.message:"Message could not be sent.")}finally{setSending(false)}
  }
  return <PortalShell title="Messages & support">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-bold tracking-[0.17em] text-[#15877d]">YOUR HEMBOX INBOX</p><h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">Messages & support</h2><p className="mt-2 text-sm text-slate-500">Keep requests and conversations together with their context.</p></div><div className="flex gap-2"><button onClick={()=>void load(selected)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"><RefreshCw className="h-3.5 w-3.5"/> Refresh</button><Link href="/portal/services/request" className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#142239] px-3 text-xs font-semibold text-white hover:bg-[#203653]">New request <ArrowUpRight className="h-3.5 w-3.5"/></Link></div></div>
    {error&&<p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}{notice&&<p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    <div className="mt-6 grid min-h-[520px] overflow-hidden rounded-2xl border border-slate-200 bg-white md:grid-cols-[minmax(230px,0.7fr)_minmax(0,1.3fr)]">
      <aside className="border-b border-slate-200 md:border-b-0 md:border-r"><div className="border-b border-slate-100 px-4 py-4"><h3 className="text-xs font-bold text-slate-800">Conversations</h3><p className="mt-1 text-[10px] text-slate-500">{threads.length} thread(s)</p></div>
        {loading?<div className="space-y-2 p-3"><div className="h-16 animate-pulse rounded-xl bg-slate-100"/><div className="h-16 animate-pulse rounded-xl bg-slate-100"/></div>:threads.length?threads.map((thread)=><button key={thread.id} onClick={()=>{setSelected(thread.id);setNotice("")}} className={"w-full border-b border-slate-100 px-4 py-4 text-left transition hover:bg-slate-50 "+(selected===thread.id?"bg-[#eef9f7]":"")}><span className="flex items-center justify-between gap-2"><span className="truncate text-xs font-bold text-slate-800">{thread.source==="billing"?"Billing conversation":thread.source==="client-portal"?"Service request":thread.type.replaceAll("_"," ")+" enquiry"}</span><span className={"rounded-full px-2 py-0.5 text-[9px] font-bold "+(thread.status==="archived"?"bg-slate-100 text-slate-500":"bg-emerald-50 text-emerald-700")}>{thread.status.replaceAll("_"," ")}</span></span><span className="mt-2 block line-clamp-2 text-[11px] leading-5 text-slate-500">{thread.messages.at(-1)?.body||thread.message||"No message content"}</span><span className="mt-2 block text-[10px] text-slate-400">{date(thread.updated_at||thread.created_at)}</span></button>):<div className="p-5 text-center"><MessageSquare className="mx-auto h-5 w-5 text-slate-400"/><p className="mt-3 text-xs font-bold text-slate-700">{error?"Inbox unavailable":"No conversations yet"}</p><p className="mt-1 text-[11px] leading-5 text-slate-500">{error?"Your conversations could not be loaded in this environment.":"Service requests and supported billing conversations will appear here."}</p><Link href="/portal/services/request" className="mt-3 inline-block text-xs font-bold text-[#16867b] hover:underline">Send a service request</Link></div>}
      </aside>
      <section className="flex min-h-[420px] min-w-0 flex-col">
        {active?<><div className="border-b border-slate-100 px-4 py-4 sm:px-5"><h3 className="text-sm font-bold text-slate-800">{active.source==="billing"?"Billing conversation":active.source==="client-portal"?"Service request conversation":"Conversation"}</h3><p className="mt-1 text-[10px] text-slate-500">Opened {date(active.created_at)} · {active.status.replaceAll("_"," ")}</p></div>
          <div className="flex-1 space-y-4 overflow-y-auto bg-[#fafbfd] p-4 sm:p-5">{(active.messages||[]).length?(active.messages||[]).map((message)=><div key={message.id} className={"flex "+(message.sender_role==="customer"?"justify-end":"justify-start")}><div className={"max-w-[88%] rounded-2xl px-4 py-3 "+(message.sender_role==="customer"?"rounded-br-md bg-[#142239] text-white":"rounded-bl-md border border-slate-200 bg-white text-slate-700")}><p className="whitespace-pre-wrap break-words text-xs leading-6">{message.body}</p><p className={"mt-2 text-right text-[9px] "+(message.sender_role==="customer"?"text-slate-300":"text-slate-400")}>{message.sender_role==="customer"?"You":"HEMBOX"} · {date(message.created_at)}</p></div></div>):<p className="text-center text-xs text-slate-500">No messages recorded for this conversation yet.</p>}</div>
          {active.status==="archived"?<p className="border-t border-slate-100 p-4 text-xs text-slate-500">This conversation is archived. Start a new request if you need further assistance.</p>:<form onSubmit={send} className="border-t border-slate-100 p-3 sm:p-4"><label htmlFor="reply" className="sr-only">Your reply</label><textarea id="reply" value={draft} onChange={(e)=>setDraft(e.target.value)} maxLength={5000} rows={3} placeholder="Write a message…" className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-xs leading-5 outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"/><div className="mt-2 flex items-center justify-between gap-3"><span className="text-[10px] text-slate-400">{draft.length}/5000</span><button disabled={sending||!draft.trim()} className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#142239] px-3 text-xs font-semibold text-white disabled:opacity-50">{sending?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<Send className="h-3.5 w-3.5"/>} Send message</button></div></form>}</>:<div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center"><MessageSquare className="h-8 w-8 text-slate-300"/><h3 className="mt-4 text-sm font-bold text-slate-800">{loading?"Loading your inbox":"Choose a conversation"}</h3><p className="mt-2 max-w-sm text-xs leading-5 text-slate-500">{loading?"Your messages will appear shortly.":"Select a thread to read messages and reply, or start a service request with HEMBOX."}</p></div>}
      </section>
    </div>
  </PortalShell>
}
