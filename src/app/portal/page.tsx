"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { PortalShell } from "@/components/portal/portal-shell"
import {
  ArrowRight, ArrowUpRight, BriefcaseBusiness, CalendarClock, CheckCircle2,
  CircleDollarSign, Clock3, FileText, FolderKanban, Globe2, MessageSquare,
  Plus, RefreshCw, Sparkles, Wallet
} from "lucide-react"

type Summary = {
  client: { id: string; company_name: string | null; status: string | null } | null
  projects: { active: number; total: number; recent: Array<{ id: string; name: string; description: string | null; status: string; deadline: string | null; updated_at: string | null }> }
  services: { tracked: boolean; active: number | null }
  billing: { outstanding_by_currency: Record<string, number>; invoices: Array<{ id: string; invoice_number: string; status: string; currency: string; total_minor: number; due_at: string | null }>; outstanding_count: number }
  domains: { count: number; recent: Array<{ id: string; domain_name: string; status: string; expires_at: string | null }> }
  conversations: { count: number }
  activity: Array<{ id: string; kind: string; title: string; detail: string; at: string | null }>
}

function money(minor: number, currency: string) {
  try { return new Intl.NumberFormat("en-ZM", { style: "currency", currency, maximumFractionDigits: 2 }).format(minor / 100) }
  catch { return currency + " " + (minor / 100).toFixed(2) }
}
function date(value: string | null) {
  if (!value) return "Date not set"
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? "Date not set" : new Intl.DateTimeFormat("en-ZM", { dateStyle: "medium" }).format(parsed)
}
function titleCase(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) }

const services = [
  { title: "Brand & creative", detail: "Identity, design systems and visual assets", icon: Sparkles },
  { title: "Websites & digital", detail: "Websites, web apps and digital experiences", icon: Globe2 },
  { title: "Apps & software", detail: "Mobile apps, platforms and custom software", icon: BriefcaseBusiness },
  { title: "Domains & infrastructure", detail: "Domains and ongoing technical services", icon: CircleDollarSign },
]

export default function ClientWorkspacePage() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  async function loadSummary() {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/portal/summary", { cache: "no-store" })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "We couldn't load your workspace.")
      setSummary(result as Summary)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "We couldn't load your workspace.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadSummary() }, [])

  return <PortalShell title="Overview">
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[10px] font-bold tracking-[0.18em] text-[#15877d]">YOUR HEMBOX WORKSPACE</p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-[#152238] sm:text-[32px]">Your work, all in one place.</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Projects, services and the next steps for everything you do with HEMBOX.</p>
        {summary?.client?.company_name && <p className="mt-2 text-xs font-semibold text-slate-600">{summary.client.company_name}</p>}
      </div>
      <Link href="/portal/services/catalogue" className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#142239] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#203653] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2">
        <Plus className="h-4 w-4"/> Request a service
      </Link>
    </div>

    {error && <div role="alert" className="mb-6 flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between">
      <span>{error}</span><button onClick={() => void loadSummary()} className="inline-flex items-center gap-2 self-start font-semibold underline underline-offset-4"><RefreshCw className="h-3.5 w-3.5"/> Try again</button>
    </div>}

    <section aria-label="Workspace summary" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard title="Active projects" icon={FolderKanban} value={loading ? "—" : String(summary?.projects.active ?? 0)} note={loading ? "Loading project status" : (summary?.projects.total ?? 0) + " projects in your workspace"} href="/portal/projects" accent="teal"/>
      <SummaryCard title="Active services" icon={BriefcaseBusiness} value={loading ? "—" : summary?.services.tracked ? String(summary.services.active ?? 0) : "—"} note={loading ? "Loading services" : summary?.services.tracked ? "Currently active" : "Service inventory is being connected"} href="/portal/services" accent="blue"/>
      <SummaryCard title="Outstanding balance" icon={Wallet} value={loading ? "—" : summary && Object.keys(summary.billing.outstanding_by_currency).length ? Object.entries(summary.billing.outstanding_by_currency).map(([currency, amount]) => money(amount, currency)).join(" · ") : money(0, "ZMW")} note={loading ? "Loading billing" : (summary?.billing.outstanding_count ?? 0) + " invoices to review"} href="/portal/bills" accent="amber"/>
      <SummaryCard title="Conversations" icon={MessageSquare} value={loading ? "—" : String(summary?.conversations.count ?? 0)} note="Your conversations with HEMBOX" href="/portal/messages" accent="violet"/>
    </section>

    <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.85fr)]">
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.025)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <div><h3 className="text-sm font-bold text-[#172338]">Your projects</h3><p className="mt-1 text-xs text-slate-500">A snapshot of work in progress</p></div>
          <Link href="/portal/projects" className="inline-flex items-center gap-1 text-xs font-semibold text-[#16867b] hover:text-[#106b63]">All projects <ArrowRight className="h-3.5 w-3.5"/></Link>
        </div>
        {loading ? <div className="space-y-3 p-5" aria-label="Loading projects"><div className="h-14 animate-pulse rounded-xl bg-slate-100"/><div className="h-14 animate-pulse rounded-xl bg-slate-100"/></div>
          : summary?.projects.recent.length ? <div className="divide-y divide-slate-100">
            {summary.projects.recent.map((project) => <Link key={project.id} href={"/portal/projects/" + project.id} className="flex items-center gap-3 px-5 py-4 transition hover:bg-slate-50/80 sm:px-6">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#edf8f6] text-[#16867b]"><FolderKanban className="h-[18px] w-[18px]"/></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{project.name}</span><span className="mt-1 block truncate text-xs text-slate-500">{project.description || "Project with HEMBOX"} · Updated {date(project.updated_at)}</span></span>
              <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600 sm:inline-flex">{titleCase(project.status)}</span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400"/>
            </Link>)}
          </div> : <div className="px-6 py-9 text-center">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-slate-500"><FolderKanban className="h-5 w-5"/></span>
            <h4 className="mt-3 text-sm font-bold text-slate-800">Your projects will appear here</h4>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">Once a project is connected to your client account, its progress, milestones and deliverables will be available here.</p>
            <Link href="/portal/services/catalogue" className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[#16867b] hover:underline">Explore services <ArrowRight className="h-3.5 w-3.5"/></Link>
          </div>}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.025)]">
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6"><h3 className="text-sm font-bold text-[#172338]">Needs your attention</h3><p className="mt-1 text-xs text-slate-500">Useful next steps, without the noise</p></div>
        {loading ? <div className="space-y-3 p-5"><div className="h-12 animate-pulse rounded-xl bg-slate-100"/><div className="h-12 animate-pulse rounded-xl bg-slate-100"/></div>
          : <div className="space-y-2 p-4 sm:p-5">
            {(summary?.billing.invoices.length ?? 0) > 0 && <Link href="/portal/bills" className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50/70 p-3.5 transition hover:border-amber-200">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-amber-700"><FileText className="h-4 w-4"/></span>
              <span className="min-w-0 flex-1"><span className="block text-xs font-bold text-slate-800">Review outstanding invoices</span><span className="mt-1 block text-[11px] leading-5 text-slate-600">{summary?.billing.outstanding_count} invoice(s) need attention.</span></span><ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-amber-700"/>
            </Link>}
            {(summary?.projects.recent ?? []).filter((project) => project.status === "review").slice(0, 2).map((project) => <Link key={project.id} href={"/portal/projects/" + project.id} className="flex items-start gap-3 rounded-xl border border-violet-100 bg-violet-50/60 p-3.5 transition hover:border-violet-200">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-violet-700"><CheckCircle2 className="h-4 w-4"/></span>
              <span className="min-w-0 flex-1"><span className="block text-xs font-bold text-slate-800">Project ready for review</span><span className="mt-1 block text-[11px] text-slate-600">{project.name}</span></span><ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-violet-700"/>
            </Link>)}
            {!(summary?.billing.invoices.length) && !(summary?.projects.recent ?? []).some((project) => project.status === "review") && <div className="rounded-xl bg-[#f3faf8] px-4 py-5 text-center">
              <CheckCircle2 className="mx-auto h-5 w-5 text-[#16867b]"/>
              <p className="mt-2 text-xs font-semibold text-slate-800">You’re all caught up</p>
              <p className="mt-1 text-[11px] leading-5 text-slate-500">We’ll surface invoices and project reviews here when action is needed.</p>
            </div>}
            <Link href="/portal/messages" className="flex items-center justify-between rounded-xl px-3 py-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-[#16867b]"><span className="inline-flex items-center gap-2"><MessageSquare className="h-4 w-4"/> Contact your HEMBOX team</span><ArrowRight className="h-3.5 w-3.5"/></Link>
          </div>}
      </section>
    </div>

    <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6"><div><h3 className="text-sm font-bold text-[#172338]">Explore what we can build together</h3><p className="mt-1 text-xs text-slate-500">Creative, digital and technical services under one roof.</p></div><Link href="/portal/services/catalogue" className="hidden items-center gap-1 text-xs font-semibold text-[#16867b] hover:underline sm:inline-flex">View catalogue <ArrowRight className="h-3.5 w-3.5"/></Link></div>
      <div className="grid divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
        {services.map((service) => { const Icon = service.icon; return <Link key={service.title} href="/portal/services/catalogue" className="group flex items-start gap-3 p-5 transition hover:bg-slate-50/80 sm:p-6">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition group-hover:border-teal/30 group-hover:bg-teal/5 group-hover:text-[#16867b]"><Icon className="h-[18px] w-[18px]"/></span>
          <span className="min-w-0 flex-1"><span className="block text-xs font-bold text-slate-800">{service.title}</span><span className="mt-1.5 block text-[11px] leading-5 text-slate-500">{service.detail}</span><span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[#16867b]">Explore <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5"/></span></span>
        </Link>})}
      </div>
    </section>

    <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white px-5 py-4 sm:px-6">
      <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-600"><ActivityIcon/></span><div className="min-w-0 flex-1"><h3 className="text-sm font-bold text-[#172338]">Recent activity</h3><p className="mt-1 text-xs text-slate-500">A short history of important workspace updates.</p></div></div>
      {loading ? <div className="mt-4 h-12 animate-pulse rounded-xl bg-slate-100"/> : summary?.activity.length ? <div className="mt-3 divide-y divide-slate-100">
        {summary.activity.slice(0, 4).map((item) => <div key={item.id} className="flex items-start gap-3 py-3">
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-teal"/>
          <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-slate-800">{item.title}</p><p className="mt-1 text-[11px] text-slate-500">{item.detail}</p></div><time className="shrink-0 text-[10px] text-slate-400">{date(item.at)}</time>
        </div>)}
      </div> : <p className="mt-4 rounded-xl bg-slate-50 px-4 py-5 text-center text-xs text-slate-500">Your important updates will appear here as activity is recorded.</p>}
    </section>
  </PortalShell>
}

function SummaryCard({ title, value, note, href, icon: Icon, accent }: { title: string; value: string; note: string; href: string; icon: typeof FolderKanban; accent: "teal" | "blue" | "amber" | "violet" }) {
  const tones = { teal: "bg-[#e8f8f5] text-[#15877d]", blue: "bg-blue-50 text-blue-700", amber: "bg-amber-50 text-amber-700", violet: "bg-violet-50 text-violet-700" }
  return <Link href={href} className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.025)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 sm:p-5">
    <div className="flex items-start justify-between gap-3"><span className="text-xs font-semibold text-slate-500">{title}</span><span className={"grid h-9 w-9 place-items-center rounded-xl " + tones[accent]}><Icon className="h-[17px] w-[17px]"/></span></div>
    <p className="mt-3 break-words text-[25px] font-extrabold tracking-[-0.04em] text-[#172338] sm:text-[28px]">{value}</p>
    <div className="mt-2 flex items-center justify-between gap-2"><p className="text-[10px] leading-4 text-slate-500">{note}</p><ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-300 transition group-hover:text-[#16867b]"/></div>
  </Link>
}
function ActivityIcon() { return <Clock3 className="h-4 w-4"/> }
