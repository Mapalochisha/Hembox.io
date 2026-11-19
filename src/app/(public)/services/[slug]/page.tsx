import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, Layers3 } from "lucide-react"
import { Navbar } from "@/components/landing/navbar"
import { Footer } from "@/components/landing/footer"
import { MockupModal } from "@/components/landing/mockup-modal"
import { ServiceProjectCTA, ServiceProjectCTASecondary } from "@/components/services/service-project-cta"
import { createClient } from "@/lib/supabase/server"

interface ProcessStep { title?: string; description?: string }
interface GalleryImage { url?: string; title?: string; caption?: string }
interface FAQ { question?: string; answer?: string }
interface PricingPackage {
  id: string
  name: string
  description: string | null
  price_amount: number | null
  price_suffix: string | null
  price_currency: string | null
  features: string[] | null
  is_popular: boolean
}
const asArray = <T,>(value: unknown): T[] => Array.isArray(value) ? value as T[] : []

function formatPrice(amount: number | null | undefined, currency = "ZMW", suffix?: string | null, model = "fixed") {
  if (model === "quote" || amount == null) return "Request a quote"
  const formatted = new Intl.NumberFormat("en-ZM", { maximumFractionDigits: 0 }).format(Number(amount))
  const symbol = currency === "USD" ? "$" : currency === "ZAR" ? "R" : "K"
  const prefix = model === "starting_from" ? "From " : ""
  return `${prefix}${symbol}${formatted}${suffix ? ` ${suffix}` : ""}`
}

function Price({ service }: { service: any }) {
  return <p className="text-3xl sm:text-4xl font-black tracking-tight text-navy">{formatPrice(service.price_amount, service.price_currency, service.price_suffix, service.pricing_model)}</p>
}

function FamilyPage({ service, children }: { service: any; children: any[] }) {
  return (
    <div className="min-h-screen bg-white text-navy">
      <Navbar />
      <main className="pt-[72px]">
        <section className="relative overflow-hidden py-20 sm:py-28">
          <div className="absolute inset-0 grid-bg opacity-50 pointer-events-none" />
          <div className="max-w-[1200px] mx-auto px-6 lg:px-8 relative">
            <Link href="/#services" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-navy transition mb-10"><ArrowLeft className="w-4 h-4" /> All solutions</Link>
            <div className="max-w-3xl">
              <p className="text-[13px] font-bold tracking-[0.2em] text-coral uppercase mb-4">Solution family</p>
              <h1 className="text-[42px] sm:text-[60px] font-black tracking-tight leading-[1.02]">{service.title}</h1>
              <p className="mt-6 text-lg sm:text-xl text-gray-600 leading-relaxed">{service.long_description || service.description}</p>
              <div className="mt-8"><ServiceProjectCTA serviceName={service.title} context={{ service: service.title, serviceId: service.id }} /></div>
            </div>
          </div>
        </section>

        <section className="py-20 bg-gray-50/70">
          <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
            <div className="max-w-2xl mb-12">
              <p className="text-[13px] font-bold tracking-[0.2em] text-coral uppercase mb-3">Explore the solutions</p>
              <h2 className="text-[32px] sm:text-[42px] font-black tracking-tight">Choose the right starting point.</h2>
              <p className="text-gray-600 mt-4">Each solution has its own dedicated page, scope and pricing. Open an offering to see exactly what is included.</p>
            </div>
            {children.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">Solutions are being added to this collection.</div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {children.map((child) => (
                  <Link key={child.id} href={`/services/${child.slug || child.id}`} className="group rounded-[28px] border border-black/5 bg-white p-7 hover:border-teal/30 hover:shadow-xl hover:shadow-navy/5 transition">
                    {child.hero_image_url && <img src={child.hero_image_url} alt="" className="w-full aspect-[16/9] object-cover rounded-2xl mb-6" />}
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="text-xl font-black group-hover:text-teal transition">{child.title}</h3>
                      <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-teal group-hover:translate-x-1 transition shrink-0" />
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-gray-600">{child.description}</p>
                    <div className="mt-6 pt-5 border-t border-gray-100 flex items-center justify-between gap-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Pricing</span>
                      <span className="font-black text-navy">{formatPrice(child.price_amount, child.price_currency, child.price_suffix, child.pricing_model)}</span>
                    </div>
                    <span className="inline-flex items-center gap-2 mt-5 text-sm font-bold text-teal">Explore offering <ArrowRight className="w-4 h-4" /></span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        {asArray<string>(service.benefits).length > 0 && (
          <section className="py-20">
            <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
              <p className="text-[13px] font-bold tracking-[0.2em] text-coral uppercase mb-3">Our approach</p>
              <h2 className="text-[32px] sm:text-[40px] font-black tracking-tight">Built around your business.</h2>
              <div className="grid md:grid-cols-3 gap-5 mt-10">{asArray<string>(service.benefits).map((item, i) => <div key={i} className="rounded-[24px] border border-black/5 p-7"><CheckCircle2 className="w-6 h-6 text-teal mb-5" /><p className="font-bold">{item}</p></div>)}</div>
            </div>
          </section>
        )}
      </main>
      <Footer />
      <MockupModal />
    </div>
  )
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (slug === "sme-website-starter" || slug === "sme-website-professional") redirect("/services/sme-website")

  const supabase = await createClient()
  const { data, error } = await supabase.from("services").select("*").eq("slug", slug).eq("status", "active").maybeSingle()
  if (error) {
    console.error("Unable to load service detail:", { slug, error })
    throw new Error("Unable to load this service. Please try again later.")
  }
  const service = data as any
  if (!service) notFound()

  if (service.page_type === "family") {
    const { data: children, error: childError } = await supabase.from("services").select("*").eq("parent_service_id", service.id).eq("status", "active").order("sort_order", { ascending: true })
    if (childError) throw new Error("Unable to load this solution family.")
    return <FamilyPage service={service} children={(children || []) as any[]} />
  }

  const [{ data: packages, error: packageError }, { data: parent }] = await Promise.all([
    supabase.from("pricing_packages").select("*").eq("service_id", service.id).eq("status", "active").order("sort_order", { ascending: true }),
    service.parent_service_id
      ? supabase.from("services").select("id,title,slug").eq("id", service.parent_service_id).maybeSingle()
      : Promise.resolve({ data: null })
  ])
  if (packageError) throw new Error("Unable to load product packages.")

  const benefits = asArray<string>(service.benefits)
  const deliverables = asArray<string>(service.deliverables)
  const process = asArray<ProcessStep>(service.process_steps)
  const gallery = asArray<GalleryImage | string>(service.gallery_images)
  const faqs = asArray<FAQ>(service.faqs)
  const productContext = { service: service.title, serviceId: service.id }
  const activePackages = (packages || []) as PricingPackage[]

  return (
    <div className="min-h-screen bg-white text-navy">
      <Navbar />
      <main className="pt-[72px]">
        <section className="relative overflow-hidden py-20 sm:py-28">
          <div className="absolute inset-0 grid-bg opacity-50 pointer-events-none" />
          <div className="max-w-[1200px] mx-auto px-6 lg:px-8 relative">
            <Link href={parent?.slug ? `/services/${parent.slug}` : "/#services"} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-navy transition mb-10"><ArrowLeft className="w-4 h-4" /> {parent?.title || "All services"}</Link>
            <div className="grid lg:grid-cols-2 gap-14 lg:gap-20 items-center">
              <div>
                <p className="text-[13px] font-bold tracking-[0.2em] text-coral uppercase mb-4">HEMBOX solution</p>
                <h1 className="text-[42px] sm:text-[56px] font-black tracking-tight leading-[1.02]">{service.title}</h1>
                <p className="mt-6 text-lg sm:text-xl text-gray-600 leading-relaxed max-w-xl">{service.long_description || service.description}</p>
                <div className="mt-8 flex flex-wrap items-end gap-6">
                  <div><p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{service.pricing_model === "starting_from" ? "Starting price" : service.pricing_model === "quote" ? "Pricing" : service.pricing_model === "packages" ? "Available packages" : "Project price"}</p><Price service={service} /></div>
                  {!activePackages.length && <ServiceProjectCTA serviceName={service.title} context={productContext} />}
                </div>
                {service.pricing_note && <p className="mt-4 text-sm text-gray-500 max-w-xl">{service.pricing_note}</p>}
              </div>
              {service.hero_image_url ? <div className="rounded-[32px] overflow-hidden border border-black/5 shadow-2xl shadow-navy/10 bg-gray-100"><img src={service.hero_image_url} alt={service.title} className="w-full aspect-[4/3] object-cover" /></div> : <div className="aspect-[4/3] rounded-[32px] bg-navy relative overflow-hidden grid-bg flex items-center justify-center"><div className="w-24 h-24 rounded-[28px] bg-teal/15 border border-teal/20 grid place-items-center"><Layers3 className="w-10 h-10 text-teal" /></div></div>}
            </div>
          </div>
        </section>

        {activePackages.length > 0 && (
          <section className="py-20 bg-gray-50/70" id="packages">
            <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
              <div className="max-w-2xl mb-12"><p className="text-[13px] font-bold tracking-[0.2em] text-coral uppercase mb-3">Choose your package</p><h2 className="text-[32px] sm:text-[42px] font-black tracking-tight">One product. The right level of service.</h2><p className="mt-4 text-gray-600">Compare the packages below. Each selection is attached to your enquiry so our team knows exactly what you are asking for.</p></div>
              <div className="grid md:grid-cols-2 gap-6">
                {activePackages.map((pkg) => (
                  <div key={pkg.id} className={`relative rounded-[28px] bg-white border p-8 flex flex-col ${pkg.is_popular ? "border-teal/40 shadow-xl shadow-teal/5" : "border-black/5"}`}>
                    {pkg.is_popular && <span className="absolute -top-3 left-7 rounded-full bg-teal px-4 py-1 text-[10px] font-black uppercase tracking-widest text-navy">Popular choice</span>}
                    <h3 className="text-2xl font-black">{pkg.name}</h3>
                    <p className="mt-2 text-gray-600">{pkg.description}</p>
                    <p className="mt-6 text-4xl font-black">{formatPrice(pkg.price_amount, pkg.price_currency || service.price_currency, pkg.price_suffix, "fixed")}</p>
                    <ul className="mt-7 space-y-3 flex-1">{asArray<string>(pkg.features).map((feature, i) => <li key={i} className="flex gap-3 text-sm text-gray-600"><CheckCircle2 className="w-5 h-5 text-teal shrink-0" />{feature}</li>)}</ul>
                    <div className="mt-8"><ServiceProjectCTA serviceName={service.title} context={{ service: service.title, serviceId: service.id, product: pkg.name, packageId: pkg.id, packageName: pkg.name, priceSnapshot: formatPrice(pkg.price_amount, pkg.price_currency || service.price_currency, pkg.price_suffix, "fixed") }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {benefits.length > 0 && <section className="py-20 bg-white"><div className="max-w-[1200px] mx-auto px-6 lg:px-8"><p className="text-[13px] font-bold tracking-[0.2em] text-coral uppercase mb-3">Why it matters</p><h2 className="text-[32px] sm:text-[40px] font-black tracking-tight">Built around your goals.</h2><div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">{benefits.map((item, i) => <div key={i} className="bg-white border border-black/5 rounded-[24px] p-7"><CheckCircle2 className="w-6 h-6 text-teal mb-5" /><p className="font-bold text-lg">{item}</p></div>)}</div></div></section>}
        {deliverables.length > 0 && <section className="py-20"><div className="max-w-[1200px] mx-auto px-6 lg:px-8 grid lg:grid-cols-[0.8fr_1.2fr] gap-14"><div><p className="text-[13px] font-bold tracking-[0.2em] text-coral uppercase mb-3">What you get</p><h2 className="text-[32px] sm:text-[40px] font-black tracking-tight">A clear deliverable, not a vague promise.</h2></div><div className="grid sm:grid-cols-2 gap-4">{deliverables.map((item, i) => <div key={i} className="rounded-[20px] border border-black/5 p-6 bg-white"><span className="text-teal font-black mr-3">{String(i + 1).padStart(2, "0")}</span><span className="font-semibold">{item}</span></div>)}</div></div></section>}
        {gallery.length > 0 && <section className="py-20 bg-navy text-white"><div className="max-w-[1200px] mx-auto px-6 lg:px-8"><p className="text-[13px] font-bold tracking-[0.2em] text-teal uppercase mb-3">Visual examples</p><h2 className="text-[32px] sm:text-[40px] font-black tracking-tight">See what this can look like.</h2><div className="grid md:grid-cols-2 gap-6 mt-10">{gallery.map((item, i) => { const image = typeof item === "string" ? { url: item } : item; return image.url ? <figure key={i} className="group overflow-hidden rounded-[28px] bg-white/5 border border-white/10"><img src={image.url} alt={image.title || service.title} className="w-full aspect-[4/3] object-cover group-hover:scale-[1.02] transition-transform duration-500" />{(image.title || image.caption) && <figcaption className="p-5">{image.title && <p className="font-bold">{image.title}</p>}{image.caption && <p className="text-white/60 text-sm mt-1">{image.caption}</p>}</figcaption>}</figure> : null })}</div></div></section>}
        {process.length > 0 && <section className="py-20"><div className="max-w-[1200px] mx-auto px-6 lg:px-8"><p className="text-[13px] font-bold tracking-[0.2em] text-coral uppercase mb-3">Our process</p><h2 className="text-[32px] sm:text-[40px] font-black tracking-tight">From idea to launch.</h2><div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 mt-10">{process.map((step, i) => <div key={i} className="rounded-[24px] bg-gray-50 border border-black/5 p-7"><div className="text-teal font-black text-sm mb-8">{String(i + 1).padStart(2, "0")}</div><h3 className="font-black text-xl">{step.title || "Step"}</h3>{step.description && <p className="text-gray-600 mt-3 leading-relaxed">{step.description}</p>}</div>)}</div></div></section>}
        {faqs.length > 0 && <section className="py-20 bg-gray-50/70"><div className="max-w-[900px] mx-auto px-6 lg:px-8"><p className="text-[13px] font-bold tracking-[0.2em] text-coral uppercase mb-3">FAQ</p><h2 className="text-[32px] sm:text-[40px] font-black tracking-tight mb-10">Questions, answered.</h2><div className="space-y-3">{faqs.map((faq, i) => <details key={i} className="group bg-white border border-black/5 rounded-[20px] p-6"><summary className="cursor-pointer list-none font-bold flex items-center justify-between gap-4">{faq.question}<ChevronDown className="w-5 h-5 shrink-0 text-gray-400 group-open:rotate-180 transition-transform" /></summary><p className="text-gray-600 leading-relaxed mt-4">{faq.answer}</p></details>)}</div></div></section>}
        <section className="py-24"><div className="max-w-[900px] mx-auto px-6 lg:px-8 text-center"><p className="text-[13px] font-bold tracking-[0.2em] text-coral uppercase mb-3">Ready when you are</p><h2 className="text-[38px] sm:text-[52px] font-black tracking-tight leading-tight">Let's build something that moves your business forward.</h2><ServiceProjectCTASecondary serviceName={service.title} context={productContext} /></div></section>
      </main>
      <Footer />
      <MockupModal />
    </div>
  )
}
