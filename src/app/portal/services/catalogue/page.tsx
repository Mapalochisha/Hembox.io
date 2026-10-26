"use client"

import Link from "next/link"
import { PortalShell } from "@/components/portal/portal-shell"
import { ArrowRight, ArrowUpRight, Boxes, CheckCircle2, Code2, Globe2, Layers3, Palette, PenTool, Smartphone, Sparkles, Wrench } from "lucide-react"

const groups = [
  { title: "Brand & creative", description: "Build a clear, distinctive identity and a consistent visual language.", icon: Palette, services: ["Brand identity & logo design", "Graphic design & marketing assets", "UI/UX and product design"] },
  { title: "Websites & digital experiences", description: "Create a digital presence that communicates clearly and works beautifully.", icon: Globe2, services: ["Business and campaign websites", "E-commerce experiences", "Web design and development"] },
  { title: "Apps & software", description: "Turn a workflow or product idea into useful, maintainable software.", icon: Smartphone, services: ["Mobile application development", "Web applications and portals", "Custom software and integrations"] },
  { title: "Digital infrastructure", description: "Keep the essential parts of your digital presence organized.", icon: Code2, services: ["Domain registration enquiries", "Hosting and maintenance enquiries", "Technical support and improvements"] },
  { title: "Product & strategy", description: "Clarify the problem, user experience and delivery plan before building.", icon: Layers3, services: ["Product discovery and planning", "Prototype and proof of concept", "Technical consulting"] },
  { title: "Custom work", description: "Have a different brief? Tell us what you need and we will help scope it.", icon: Wrench, services: ["Custom digital solutions", "Ongoing improvements", "Multi-service engagements"] },
]

export default function ServiceCataloguePage() {
  return <PortalShell title="Service catalogue">
    <div className="mx-auto max-w-5xl">
      <div className="overflow-hidden rounded-3xl bg-[#111c2e] p-6 text-white sm:p-9">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl"><span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[10px] font-bold tracking-[0.14em] text-teal"><Sparkles className="h-3.5 w-3.5"/> MADE AROUND YOUR GOALS</span>
            <h2 className="mt-5 text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">What can we help you create?</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">From brand identity to applications and digital infrastructure, explore the ways HEMBOX can help move your idea forward.</p>
          </div>
          <Link href="/portal/services/request" className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-teal px-4 text-sm font-bold text-[#102033] transition hover:bg-teal/90">Tell us what you need <ArrowRight className="h-4 w-4"/></Link>
        </div>
      </div>

      <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-bold tracking-[0.17em] text-[#15877d]">OUR CAPABILITIES</p><h3 className="mt-2 text-xl font-extrabold tracking-tight text-[#172338]">Services built around your business</h3></div><p className="max-w-md text-xs leading-5 text-slate-500">Every engagement starts with understanding the brief. Final scope, timing and pricing are confirmed with you before work begins.</p></div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => { const Icon = group.icon; return <article key={group.title} className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.025)] transition hover:border-slate-300 hover:shadow-sm sm:p-6">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#e9f8f5] text-[#16867b]"><Icon className="h-5 w-5"/></span>
          <h4 className="mt-4 text-sm font-bold text-[#172338]">{group.title}</h4><p className="mt-2 min-h-10 text-xs leading-5 text-slate-500">{group.description}</p>
          <ul className="mt-4 flex-1 space-y-2.5">{group.services.map((service) => <li key={service} className="flex items-start gap-2 text-xs text-slate-600"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#16867b]"/><span>{service}</span></li>)}</ul>
          <Link href={"/portal/services/request?category=" + encodeURIComponent(group.title)} className="mt-5 inline-flex items-center gap-1.5 border-t border-slate-100 pt-4 text-xs font-bold text-[#16867b] hover:text-[#105f58]">Request this type of work <ArrowUpRight className="h-3.5 w-3.5"/></Link>
        </article>})}
      </div>
      <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><p className="text-sm font-bold text-slate-800">Not sure where to start?</p><p className="mt-1 text-xs text-slate-500">Describe the outcome you need. We can help work out the right approach.</p></div><Link href="/portal/services/request" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#142239] px-4 text-xs font-semibold text-white hover:bg-[#203653]">Start a request <ArrowRight className="h-3.5 w-3.5"/></Link></div>
    </div>
  </PortalShell>
}
