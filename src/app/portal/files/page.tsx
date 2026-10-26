import Link from "next/link"
import { PortalShell } from "@/components/portal/portal-shell"
import { ArrowRight, Files, FolderKanban, LockKeyhole } from "lucide-react"

export default function ClientFilesPage() {
  return <PortalShell title="Files">
    <div><p className="text-[10px] font-bold tracking-[0.17em] text-[#15877d]">YOUR DELIVERABLE LIBRARY</p><h2 className="mt-2 text-2xl font-extrabold tracking-tight text-[#172338] sm:text-3xl">Files & deliverables</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">A central place for approved designs, documents, builds and other assets HEMBOX shares with you.</p></div>
    <div className="mt-7 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-600"><Files className="h-5 w-5"/></span><h3 className="mt-4 text-sm font-bold text-slate-800">Your file library is being prepared</h3><p className="mx-auto mt-2 max-w-lg text-xs leading-6 text-slate-500">The current application has private billing receipt storage, but it does not yet have a general-purpose deliverables library. We will connect a private storage model with project ownership and controlled downloads before showing client files here.</p><div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-600"><LockKeyhole className="h-3.5 w-3.5"/> Private by design</div><div><Link href="/portal/projects" className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-[#16867b] hover:underline">View your projects <FolderKanban className="h-3.5 w-3.5"/><ArrowRight className="h-3.5 w-3.5"/></Link></div></div>
  </PortalShell>
}
