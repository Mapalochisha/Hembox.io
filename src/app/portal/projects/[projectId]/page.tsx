"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { FormEvent, useEffect, useState } from "react"
import { PortalShell } from "@/components/portal/portal-shell"
import { ArrowDownToLine, ArrowLeft, CalendarClock, CheckCircle2, Clock3, FileText, FolderKanban, Loader2, MessageSquare, Send, ShieldCheck, ThumbsUp } from "lucide-react"

type Project = { id:string; name:string; description:string|null; status:string; deadline:string|null; updated_at:string|null }
type Milestone = { id:string; title:string; description:string|null; status:string; due_at:string|null; approved_at:string|null }
type Deliverable = { id:string; milestone_id:string|null; title:string; description:string|null; filename:string; mime_type:string|null; size_bytes:number|null; version:number; status:string; feedback_note:string|null; shared_at:string|null; approved_at:string|null; created_at:string }
type ChangeRequest = { id:string; title:string; description:string; status:string; decision_note:string|null; created_at:string }
type Activity = { id:string; actor_role:string; event_type:string; title:string; created_at:string }
type Workspace = { milestones:Milestone[]; deliverables:Deliverable[]; changeRequests:ChangeRequest[]; activity:Activity[] }
function date(value:string|null){if(!value)return "Not scheduled";const parsed=new Date(value);return Number.isNaN(parsed.getTime())?"Not scheduled":parsed.toLocaleDateString("en-ZM",{dateStyle:"medium"})}
function tone(status:string){if(["approved","completed"].includes(status))return "bg-emerald-50 text-emerald-700";if(["ready_for_review","shared"].includes(status))return "bg-violet-50 text-violet-700";if(["in_progress","under_review"].includes(status))return "bg-blue-50 text-blue-700";if(["blocked","changes_requested","declined"].includes(status))return "bg-amber-50 text-amber-800";return "bg-slate-100 text-slate-600"}
function label(value:string){return value.replaceAll("_"," ").replace(/\b\w/g,(letter)=>letter.toUpperCase())}

export default function ProjectDetailPage(){
 const params=useParams<{projectId:string}>()
 const [project,setProject]=useState<Project|null>(null)
 const [workspace,setWorkspace]=useState<Workspace|null>(null)
 const [loading,setLoading]=useState(true)
 const [collaborationUnavailable,setCollaborationUnavailable]=useState(false)
 const [error,setError]=useState("")
 const [notice,setNotice]=useState("")
 const [busy,setBusy]=useState("")
 const [feedbackTarget,setFeedbackTarget]=useState<Deliverable|null>(null)
 const [feedbackNote,setFeedbackNote]=useState("")
 const [changeTitle,setChangeTitle]=useState("")
 const [changeDescription,setChangeDescription]=useState("")
 const [showChangeForm,setShowChangeForm]=useState(false)

 async function load(){
  setLoading(true);setError("")
  try{
   const response=await fetch("/api/portal/projects?projectId="+encodeURIComponent(params.projectId),{cache:"no-store"})
   const result=await response.json()
   if(!response.ok)throw new Error(result.error||"Project not found.")
   setProject(result.projects?.[0]??null)
   const collaboration=await fetch("/api/portal/projects/workspace?projectId="+encodeURIComponent(params.projectId),{cache:"no-store"})
   const collaborationResult=await collaboration.json()
   if(collaboration.ok){setWorkspace(collaborationResult as Workspace);setCollaborationUnavailable(false)}
   else{setWorkspace(null);setCollaborationUnavailable(true)}
  }catch(e){setError(e instanceof Error?e.message:"Project details are unavailable.")}
  finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[params.projectId])

 async function action(body:Record<string,string>){
  setBusy(body.action||"action");setError("");setNotice("")
  try{const response=await fetch("/api/portal/projects/workspace",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({projectId:params.projectId,...body})});const result=await response.json();if(!response.ok)throw new Error(result.error||"Could not save this project update.");setNotice(result.message||"Project update saved.");setFeedbackTarget(null);setFeedbackNote("");setShowChangeForm(false);setChangeTitle("");setChangeDescription("");await load()}
  catch(e){setError(e instanceof Error?e.message:"Could not save this project update.")}
  finally{setBusy("")}
 }
 async function download(deliverable:Deliverable){
  setBusy("download-"+deliverable.id);setError("")
  try{const response=await fetch("/api/portal/files?deliverableId="+encodeURIComponent(deliverable.id),{cache:"no-store"});const result=await response.json();if(!response.ok)throw new Error(result.error||"Download unavailable.");window.open(result.url,"_blank","noopener,noreferrer")}
  catch(e){setError(e instanceof Error?e.message:"Download unavailable.")}
  finally{setBusy("")}
 }
 function submitChange(event:FormEvent<HTMLFormElement>){event.preventDefault();void action({action:"create_change_request",title:changeTitle,description:changeDescription})}
 function submitFeedback(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!feedbackTarget)return;void action({action:"request_deliverable_changes",deliverableId:feedbackTarget.id,note:feedbackNote})}

 return <PortalShell title="Project details">
  <Link href="/portal/projects" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-[#16867b]"><ArrowLeft className="h-3.5 w-3.5"/> All projects</Link>
  {error&&<p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
  {notice&&<p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
  {loading?<div className="mt-5 h-56 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200"/>:!project?<div role="alert" className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{error||"Project not found."}</div>:<>
   <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-start gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#e9f8f5] text-[#16867b]"><FolderKanban className="h-6 w-6"/></span><div><p className="text-[10px] font-bold tracking-[0.17em] text-[#15877d]">PROJECT WORKSPACE</p><h2 className="mt-2 text-2xl font-extrabold tracking-tight text-[#172338] sm:text-3xl">{project.name}</h2><p className="mt-2 text-xs text-slate-500">Last updated {date(project.updated_at)}</p></div></div><span className={"self-start rounded-full px-3 py-1.5 text-xs font-bold "+tone(project.status)}>{label(project.status)}</span></div><p className="mt-6 max-w-3xl whitespace-pre-wrap text-sm leading-7 text-slate-600">{project.description||"Your HEMBOX team will add the project brief and next steps here as they become available."}</p><div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="flex items-start gap-3 rounded-xl border border-slate-200 p-4"><CalendarClock className="mt-0.5 h-4 w-4 text-slate-500"/><div><p className="text-xs font-bold text-slate-800">Target date</p><p className="mt-1 text-xs text-slate-500">{date(project.deadline)}</p></div></div><div className="flex items-start gap-3 rounded-xl border border-slate-200 p-4"><ShieldCheck className="mt-0.5 h-4 w-4 text-slate-500"/><div><p className="text-xs font-bold text-slate-800">Project access</p><p className="mt-1 text-xs text-slate-500">Visible only through your authenticated client account.</p></div></div></div></div>

   {collaborationUnavailable&&<div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"/><div><p className="text-xs font-bold text-amber-900">Project collaboration is not connected in this environment yet</p><p className="mt-1 text-xs leading-5 text-amber-800">The structured milestone and deliverable model is included in the feature migration. Once that migration is applied to the intended environment, this section will show reviews, approvals, change requests and activity.</p></div></div>}

   {workspace&&<div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
    <div className="space-y-5">
     <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="text-sm font-bold text-slate-800">Milestones</h3><p className="mt-1 text-[10px] text-slate-500">Delivery progress and client sign-off</p></div><span className="text-[10px] font-semibold text-slate-400">{workspace.milestones.length} total</span></div>
      {workspace.milestones.length? <div className="divide-y divide-slate-100">{workspace.milestones.map((milestone)=><div key={milestone.id} className="flex items-start gap-3 p-4 sm:p-5"><span className={"mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl "+(milestone.status==="approved"||milestone.status==="completed"?"bg-emerald-50 text-emerald-700":"bg-slate-100 text-slate-500")}>{milestone.status==="approved"||milestone.status==="completed"?<CheckCircle2 className="h-4 w-4"/>:<CalendarClock className="h-4 w-4"/>}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h4 className="text-xs font-bold text-slate-800">{milestone.title}</h4><span className={"rounded-full px-2 py-0.5 text-[9px] font-bold "+tone(milestone.status)}>{label(milestone.status)}</span></div>{milestone.description&&<p className="mt-1 text-xs leading-5 text-slate-500">{milestone.description}</p>}<p className="mt-2 text-[10px] text-slate-400">Target {date(milestone.due_at)}</p></div>{milestone.status==="ready_for_review"&&<button disabled={!!busy} onClick={()=>void action({action:"approve_milestone",milestoneId:milestone.id})} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#142239] px-3 py-2 text-[10px] font-semibold text-white disabled:opacity-50"><ThumbsUp className="h-3 w-3"/> Approve</button>}</div>)}</div>:<p className="p-6 text-xs text-slate-500">Milestones will appear here when HEMBOX adds them to this project.</p>}
     </section>
     <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="text-sm font-bold text-slate-800">Deliverables</h3><p className="mt-1 text-[10px] text-slate-500">Files shared for review or handover</p></div><span className="text-[10px] font-semibold text-slate-400">{workspace.deliverables.length} total</span></div>
      {workspace.deliverables.length?<div className="divide-y divide-slate-100">{workspace.deliverables.map((deliverable)=><div key={deliverable.id} className="p-4 sm:p-5"><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"><FileText className="h-4 w-4"/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h4 className="text-xs font-bold text-slate-800">{deliverable.title}</h4><span className={"rounded-full px-2 py-0.5 text-[9px] font-bold "+tone(deliverable.status)}>{label(deliverable.status)}</span><span className="text-[9px] text-slate-400">v{deliverable.version}</span></div><p className="mt-1 break-all text-[10px] text-slate-500">{deliverable.filename} · {deliverable.size_bytes?Math.round(deliverable.size_bytes/1024)+" KB":"Size unavailable"}</p>{deliverable.description&&<p className="mt-2 text-xs leading-5 text-slate-500">{deliverable.description}</p>}{deliverable.feedback_note&&<p className="mt-2 rounded-lg bg-amber-50 p-2 text-[10px] leading-5 text-amber-900">Feedback: {deliverable.feedback_note}</p>}</div><button onClick={()=>void download(deliverable)} disabled={!!busy} aria-label={"Download "+deliverable.filename} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50">{busy==="download-"+deliverable.id?<Loader2 className="h-4 w-4 animate-spin"/>:<ArrowDownToLine className="h-4 w-4"/>}</button></div>
       {deliverable.status==="shared"&&<div className="mt-3 flex flex-wrap justify-end gap-2"><button disabled={!!busy} onClick={()=>void action({action:"approve_deliverable",deliverableId:deliverable.id})} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-bold text-white disabled:opacity-50"><CheckCircle2 className="h-3 w-3"/> Approve deliverable</button><button disabled={!!busy} onClick={()=>{setFeedbackTarget(deliverable);setFeedbackNote("")}} className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Request changes</button></div>}
      </div>)}</div>:<p className="p-6 text-xs text-slate-500">Deliverables shared by HEMBOX will appear here with version and review status.</p>}
     </section>
     {feedbackTarget&&<form onSubmit={submitFeedback} className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><h3 className="text-sm font-bold text-amber-950">Request changes: {feedbackTarget.title}</h3><label className="mt-3 block"><span className="text-xs font-semibold text-amber-950">What should be changed?</span><textarea required minLength={5} maxLength={2000} value={feedbackNote} onChange={(e)=>setFeedbackNote(e.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-amber-200 bg-white p-3 text-xs outline-none focus:border-amber-400"/></label><div className="mt-3 flex justify-end gap-2"><button type="button" onClick={()=>setFeedbackTarget(null)} className="rounded-lg border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-900">Cancel</button><button disabled={!!busy} className="inline-flex items-center gap-2 rounded-lg bg-amber-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busy==="request_deliverable_changes"?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<Send className="h-3.5 w-3.5"/>} Submit feedback</button></div></form>}
    </div>
    <div className="space-y-5">
     <section className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-800">Change requests</h3><p className="mt-1 text-[10px] text-slate-500">Scope changes are tracked separately from the original quote.</p></div><button onClick={()=>setShowChangeForm((v)=>!v)} className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-700 hover:bg-slate-50">{showChangeForm?"Cancel":"New request"}</button></div>
      {showChangeForm&&<form onSubmit={submitChange} className="mt-4 space-y-3"><label className="block"><span className="text-[10px] font-bold text-slate-700">Request title</span><input required minLength={3} maxLength={180} value={changeTitle} onChange={(e)=>setChangeTitle(e.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-teal"/></label><label className="block"><span className="text-[10px] font-bold text-slate-700">Details</span><textarea required minLength={10} maxLength={4000} rows={4} value={changeDescription} onChange={(e)=>setChangeDescription(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs leading-5 outline-none focus:border-teal"/></label><button disabled={!!busy} className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-[#142239] px-3 text-xs font-bold text-white disabled:opacity-50">{busy==="create_change_request"?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<Send className="h-3.5 w-3.5"/>} Submit change request</button></form>}
      <div className="mt-4 space-y-3">{workspace.changeRequests.length?workspace.changeRequests.map((request)=><div key={request.id} className="rounded-xl border border-slate-100 p-3"><div className="flex items-start justify-between gap-2"><p className="text-xs font-bold text-slate-800">{request.title}</p><span className={"rounded-full px-2 py-0.5 text-[9px] font-bold "+tone(request.status)}>{label(request.status)}</span></div><p className="mt-2 whitespace-pre-wrap text-[11px] leading-5 text-slate-600">{request.description}</p>{request.decision_note&&<p className="mt-2 text-[10px] text-slate-500">HEMBOX: {request.decision_note}</p>}<p className="mt-2 text-[9px] text-slate-400">{date(request.created_at)}</p></div>):<p className="text-xs text-slate-500">No change requests have been submitted.</p>}</div>
     </section>
     <section className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-slate-500"/><h3 className="text-sm font-bold text-slate-800">Project activity</h3></div>{workspace.activity.length?<div className="mt-4 space-y-4">{workspace.activity.slice(0,10).map((item)=><div key={item.id} className="flex items-start gap-3"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal"/><div><p className="text-xs font-semibold text-slate-800">{item.title}</p><p className="mt-1 text-[10px] text-slate-500">{label(item.actor_role)} · {date(item.created_at)}</p></div></div>)}</div>:<p className="mt-4 text-xs leading-5 text-slate-500">Important project decisions and status changes will appear here.</p>}</section>
     <section className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="text-sm font-bold text-slate-800">Need help?</h3><p className="mt-2 text-xs leading-5 text-slate-500">Ask a question about this project or send additional context to your HEMBOX team.</p><Link href="/portal/messages" className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-[#16867b] hover:underline"><MessageSquare className="h-3.5 w-3.5"/> Open messages</Link></section>
    </div>
   </div>}
  </>}
 </PortalShell>
}
