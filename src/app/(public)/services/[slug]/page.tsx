import Link from "next/link"
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronDown } from "lucide-react"
import { Navbar } from "@/components/landing/navbar"
import { Footer } from "@/components/landing/footer"
import { MockupModal } from "@/components/landing/mockup-modal"
import { ServiceProjectCTA, ServiceProjectCTASecondary } from "@/components/services/service-project-cta"
import { createClient } from "@/lib/supabase/server"

interface ProcessStep { title?: string; description?: string }
interface GalleryImage { url?: string; title?: string; caption?: string }
interface FAQ { question?: string; answer?: string }
const asArray = <T,>(value: unknown): T[] => Array.isArray(value) ? value as T[] : []

export default async function ServicePage({ params }: { params: { slug: string } }) {
  const supabase = createClient()
  const { data } = await supabase.from("services").select("*").eq("slug", params.slug).eq("status", "active").maybeSingle()
  const service = data as any

  if (!service) {
    return <main className="min-h-screen bg-white grid place-items-center px-6"><div className="text-center"><p className="text-[13px] font-bold tracking-[0.2em] text-coral uppercase mb-3">Service not found</p><h1 className="text-4xl font-black text-navy">That service is unavailable.</h1><Link href="/#services" className="inline-flex mt-8 h-12 px-6 rounded-full bg-navy text-white font-semibold items-center gap-2">Back to services <ArrowRight className="w-4 h-4" /></Link></div></main>
  }

  const benefits = asArray<string>(service.benefits)
  const deliverables = asArray<string>(service.deliverables)
  const process = asArray<ProcessStep>(service.process_steps)
  const gallery = asArray<GalleryImage | string>(service.gallery_images)
  const faqs = asArray<FAQ>(service.faqs)

  return <div className="min-h-screen bg-white text-navy"><Navbar /><main className="pt-[72px]">
    <section className="relative overflow-hidden py-20 sm:py-28"><div className="absolute inset-0 grid-bg opacity-50 pointer-events-none" /><div className="max-w-[1200px] mx-auto px-6 lg:px-8 relative"><Link href="/#services" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-navy transition mb-10"><ArrowLeft className="w-4 h-4" /> All services</Link><div className="grid lg:grid-cols-2 gap-14 lg:gap-20 items-center"><div><p className="text-[13px] font-bold tracking-[0.2em] text-coral uppercase mb-4">Hembox service</p><h1 className="text-[42px] sm:text-[56px] font-black tracking-tight leading-[1.02]">{service.title}</h1><p className="mt-6 text-lg sm:text-xl text-gray-600 leading-relaxed max-w-xl">{service.long_description || service.description}</p><div className="mt-8"><ServiceProjectCTA /></div></div>{service.hero_image_url ? <div className="rounded-[32px] overflow-hidden border border-black/5 shadow-2xl shadow-navy/10 bg-gray-100"><img src={service.hero_image_url} alt={service.title} className="w-full aspect-[4/3] object-cover" /></div> : <div className="aspect-[4/3] rounded-[32px] bg-navy relative overflow-hidden grid-bg flex items-center justify-center"><div className="w-24 h-24 rounded-[28px] bg-teal/15 border border-teal/20 grid place-items-center"><ArrowRight className="w-10 h-10 text-teal" /></div></div>}</div></div></section>
    {benefits.length > 0 && <section className="py-20 bg-gray-50/70"><div className="max-w-[1200px] mx-auto px-6 lg:px-8"><p className="text-[13px] font-bold tracking-[0.2em] text-coral uppercase mb-3">Why it matters</p><h2 className="text-[32px] sm:text-[40px] font-black tracking-tight">Built around your goals.</h2><div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">{benefits.map((item, i) => <div key={i} className="bg-white border border-black/5 rounded-[24px] p-7"><CheckCircle2 className="w-6 h-6 text-teal mb-5" /><p className="font-bold text-lg">{item}</p></div>)}</div></div></section>}
    {deliverables.length > 0 && <section className="py-20"><div className="max-w-[1200px] mx-auto px-6 lg:px-8 grid lg:grid-cols-[0.8fr_1.2fr] gap-14"><div><p className="text-[13px] font-bold tracking-[0.2em] text-coral uppercase mb-3">What you get</p><h2 className="text-[32px] sm:text-[40px] font-black tracking-tight">A clear deliverable, not a vague promise.</h2></div><div className="grid sm:grid-cols-2 gap-4">{deliverables.map((item, i) => <div key={i} className="rounded-[20px] border border-black/5 p-6 bg-white"><span className="text-teal font-black mr-3">{String(i + 1).padStart(2, "0")}</span><span className="font-semibold">{item}</span></div>)}</div></div></section>}
    {gallery.length > 0 && <section className="py-20 bg-navy text-white"><div className="max-w-[1200px] mx-auto px-6 lg:px-8"><p className="text-[13px] font-bold tracking-[0.2em] text-teal uppercase mb-3">Visual examples</p><h2 className="text-[32px] sm:text-[40px] font-black tracking-tight">See what this can look like.</h2><div className="grid md:grid-cols-2 gap-6 mt-10">{gallery.map((item, i) => { const image = typeof item === "string" ? { url: item } : item; return image.url ? <figure key={i} className="group overflow-hidden rounded-[28px] bg-white/5 border border-white/10"><img src={image.url} alt={image.title || service.title} className="w-full aspect-[4/3] object-cover group-hover:scale-[1.02] transition-transform duration-500" />{(image.title || image.caption) && <figcaption className="p-5">{image.title && <p className="font-bold">{image.title}</p>}{image.caption && <p className="text-white/60 text-sm mt-1">{image.caption}</p>}</figcaption>}</figure> : null })}</div></div></section>}
    {process.length > 0 && <section className="py-20"><div className="max-w-[1200px] mx-auto px-6 lg:px-8"><p className="text-[13px] font-bold tracking-[0.2em] text-coral uppercase mb-3">Our process</p><h2 className="text-[32px] sm:text-[40px] font-black tracking-tight">From idea to launch.</h2><div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 mt-10">{process.map((step, i) => <div key={i} className="rounded-[24px] bg-gray-50 border border-black/5 p-7"><div className="text-teal font-black text-sm mb-8">{String(i + 1).padStart(2, "0")}</div><h3 className="font-black text-xl">{step.title || "Step"}</h3>{step.description && <p className="text-gray-600 mt-3 leading-relaxed">{step.description}</p>}</div>)}</div></div></section>}
    {faqs.length > 0 && <section className="py-20 bg-gray-50/70"><div className="max-w-[900px] mx-auto px-6 lg:px-8"><p className="text-[13px] font-bold tracking-[0.2em] text-coral uppercase mb-3">FAQ</p><h2 className="text-[32px] sm:text-[40px] font-black tracking-tight mb-10">Questions, answered.</h2><div className="space-y-3">{faqs.map((faq, i) => <details key={i} className="group bg-white border border-black/5 rounded-[20px] p-6"><summary className="cursor-pointer list-none font-bold flex items-center justify-between gap-4">{faq.question}<ChevronDown className="w-5 h-5 shrink-0 text-gray-400 group-open:rotate-180 transition-transform" /></summary><p className="text-gray-600 leading-relaxed mt-4">{faq.answer}</p></details>)}</div></div></section>}
    <section className="py-24"><div className="max-w-[900px] mx-auto px-6 lg:px-8 text-center"><p className="text-[13px] font-bold tracking-[0.2em] text-coral uppercase mb-3">Ready when you are</p><h2 className="text-[38px] sm:text-[52px] font-black tracking-tight leading-tight">Let&apos;s build something that moves your business forward.</h2><ServiceProjectCTASecondary /></div></section>
  </main><Footer /><MockupModal /></div>
}
