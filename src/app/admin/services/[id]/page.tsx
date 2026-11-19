"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Check, ImagePlus, Loader2, Plus, Trash2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"

interface GalleryItem { url: string; title?: string; caption?: string }
interface Step { title: string; description: string }
interface FAQ { question: string; answer: string }

const splitLines = (value: string) => value.split("\n").map(v => v.trim()).filter(Boolean)
const parsePairs = (value: string) => splitLines(value).map(line => { const [title, ...rest] = line.split("|"); return { title: title.trim(), description: rest.join("|").trim() } })

export default function AdminServiceDetailsPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [parentOptions, setParentOptions] = useState<{ id: string; title: string }[]>([])
  const [form, setForm] = useState({ title: "", description: "", slug: "", hero_image_url: "", long_description: "", benefits: "", deliverables: "", gallery_images: "", process_steps: "", faqs: "", page_type: "product", parent_service_id: "", pricing_model: "quote", price_amount: "", price_currency: "ZMW", price_suffix: "/project", pricing_note: "" })

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from("services").select("*").eq("id", params.id).maybeSingle()
      if (error || !data) { toast({ title: "Service not found", variant: "destructive" }); setLoading(false); return }
      const service = data as any
      const { data: parents } = await supabase.from("services").select("id,title").eq("page_type", "family").eq("status", "active").neq("id", params.id).order("sort_order", { ascending: true })
      setParentOptions((parents || []) as { id: string; title: string }[])
      const gallery = Array.isArray(service.gallery_images) ? service.gallery_images : []
      const steps = Array.isArray(service.process_steps) ? service.process_steps : []
      const faqs = Array.isArray(service.faqs) ? service.faqs : []
      setForm({
        title: service.title || "", description: service.description || "", slug: service.slug || "",
        page_type: service.page_type || "product", parent_service_id: service.parent_service_id || "",
        pricing_model: service.pricing_model || "quote", price_amount: service.price_amount == null ? "" : String(service.price_amount),
        price_currency: service.price_currency || "ZMW", price_suffix: service.price_suffix || "/project", pricing_note: service.pricing_note || "",
        hero_image_url: service.hero_image_url || "", long_description: service.long_description || "",
        benefits: Array.isArray(service.benefits) ? service.benefits.join("\n") : "",
        deliverables: Array.isArray(service.deliverables) ? service.deliverables.join("\n") : "",
        gallery_images: gallery.map((item: GalleryItem | string) => typeof item === "string" ? item : [item.url, item.title || "", item.caption || ""].join(" | ")).join("\n"),
        process_steps: steps.map((item: Step) => `${item.title || ""} | ${item.description || ""}`).join("\n"),
        faqs: faqs.map((item: FAQ) => `${item.question || ""} | ${item.answer || ""}`).join("\n")
      })
      setLoading(false)
    }
    load()
  }, [params.id])

  const uploadImage = async (file: File, appendToGallery = false) => {
    setUploading(true)
    try {
      const body = new FormData(); body.append("file", file)
      const response = await fetch("/api/upload", { method: "POST", body })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Upload failed")
      setForm(current => ({ ...current, ...(appendToGallery ? { gallery_images: current.gallery_images ? `${current.gallery_images}\n${result.url}` : result.url } : { hero_image_url: result.url }) }))
      toast({ title: "Image uploaded" })
    } catch (error: any) { toast({ title: "Upload failed", description: error.message, variant: "destructive" }) }
    finally { setUploading(false) }
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true)
    try {
      const gallery = splitLines(form.gallery_images).map(line => { const [url, title = "", caption = ""] = line.split("|"); return { url: url.trim(), title: title.trim(), caption: caption.trim() } }).filter(item => item.url)
      const { error } = await supabase.from("services").update({
        title: form.title.trim(), description: form.description.trim(), slug: form.slug.trim(),
        page_type: form.page_type, parent_service_id: form.page_type === "family" || !form.parent_service_id ? null : form.parent_service_id,
        pricing_model: form.page_type === "family" ? "quote" : form.pricing_model,
        price_amount: form.page_type === "family" || form.pricing_model === "quote" || form.pricing_model === "packages" || !form.price_amount ? null : Number(form.price_amount),
        price_currency: form.price_currency, price_suffix: form.price_suffix.trim() || null, pricing_note: form.pricing_note.trim() || null,
        hero_image_url: form.hero_image_url.trim() || null,
        long_description: form.long_description.trim() || null, benefits: splitLines(form.benefits), deliverables: splitLines(form.deliverables),
        gallery_images: gallery, process_steps: parsePairs(form.process_steps), faqs: parsePairs(form.faqs).map(item => ({ question: item.title, answer: item.description }))
      } as any).eq("id", params.id)
      if (error) throw error
      toast({ title: "Service details saved", description: "Your service page content is updated." })
    } catch (error: any) { toast({ title: "Could not save", description: error.message, variant: "destructive" }) }
    finally { setSaving(false) }
  }

  if (loading) return <div className="h-[400px] grid place-items-center"><Loader2 className="w-8 h-8 text-teal animate-spin" /></div>

  return (
    <div className="max-w-5xl space-y-8">
      <div className="flex items-center gap-4"><Link href="/admin/services" className="w-10 h-10 rounded-xl border border-black/5 grid place-items-center hover:bg-gray-50"><ArrowLeft className="w-5 h-5" /></Link><div><p className="text-sm text-gray-500">Service Offerings</p><h1 className="text-3xl font-black text-navy">Service Details</h1></div></div>
      <form onSubmit={save} className="space-y-6">
        <Card className="rounded-[24px]"><CardHeader><CardTitle>Core content</CardTitle></CardHeader><CardContent className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2"><Label>Service title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></div>
          <div className="space-y-2"><Label>URL slug</Label><Input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-") })} placeholder="web-design-development" required /></div>
          <div className="md:col-span-2 space-y-2"><Label>Short description</Label><textarea className="w-full min-h-24 rounded-xl border border-input px-4 py-3 text-sm" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required /></div>
          <div className="md:col-span-2 space-y-2"><Label>Detailed introduction</Label><textarea className="w-full min-h-36 rounded-xl border border-input px-4 py-3 text-sm" value={form.long_description} onChange={e => setForm({ ...form, long_description: e.target.value })} placeholder="Explain the service and the business problem it solves." /></div>
        </CardContent></Card>

        <Card className="rounded-[24px]"><CardHeader><CardTitle>Catalogue structure & pricing</CardTitle><p className="text-sm text-gray-500">Choose whether this entry is a parent family or an individual product. Product prices are displayed on their own pages.</p></CardHeader><CardContent className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2"><Label>Catalogue entry type</Label><select className="w-full h-11 rounded-xl border border-input bg-white px-3 text-sm" value={form.page_type} onChange={e => setForm({ ...form, page_type: e.target.value, parent_service_id: e.target.value === "family" ? "" : form.parent_service_id })}><option value="product">Individual product</option><option value="family">Parent product family</option></select></div>
          <div className="space-y-2"><Label>Parent family</Label><select disabled={form.page_type === "family"} className="w-full h-11 rounded-xl border border-input bg-white px-3 text-sm disabled:opacity-50" value={form.parent_service_id} onChange={e => setForm({ ...form, parent_service_id: e.target.value })}><option value="">No parent (standalone)</option>{parentOptions.map(parent => <option key={parent.id} value={parent.id}>{parent.title}</option>)}</select></div>
          <div className="space-y-2"><Label>Pricing model</Label><select disabled={form.page_type === "family"} className="w-full h-11 rounded-xl border border-input bg-white px-3 text-sm disabled:opacity-50" value={form.pricing_model} onChange={e => setForm({ ...form, pricing_model: e.target.value })}><option value="fixed">Fixed price</option><option value="starting_from">Starting from</option><option value="quote">Request a quote</option><option value="packages">Selectable packages</option></select></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Public price</Label><Input type="number" min="0" step="0.01" disabled={form.page_type === "family" || form.pricing_model === "quote" || form.pricing_model === "packages"} value={form.price_amount} onChange={e => setForm({ ...form, price_amount: e.target.value })} placeholder="e.g. 4500" /></div>
            <div className="space-y-2"><Label>Currency</Label><select className="w-full h-11 rounded-xl border border-input bg-white px-3 text-sm" value={form.price_currency} onChange={e => setForm({ ...form, price_currency: e.target.value })}><option value="ZMW">ZMW (K)</option><option value="USD">USD ($)</option><option value="ZAR">ZAR (R)</option></select></div>
          </div>
          <div className="space-y-2"><Label>Price suffix</Label><Input value={form.price_suffix} onChange={e => setForm({ ...form, price_suffix: e.target.value })} placeholder="/project or /month" /></div>
          <div className="md:col-span-2 space-y-2"><Label>Pricing note / exclusions</Label><textarea className="w-full min-h-20 rounded-xl border border-input px-4 py-3 text-sm" value={form.pricing_note} onChange={e => setForm({ ...form, pricing_note: e.target.value })} placeholder="Explain what is excluded or how the final quote is determined." /></div>
          {form.pricing_model === "packages" && <p className="md:col-span-2 text-sm text-gray-500">Manage the package tiers in Admin → Pricing Packages and attach each tier to this product.</p>}
        </CardContent></Card>

        <Card className="rounded-[24px]"><CardHeader><CardTitle>Hero visual</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex gap-3"><Input value={form.hero_image_url} onChange={e => setForm({ ...form, hero_image_url: e.target.value })} placeholder="Image URL" /><label className="inline-flex items-center gap-2 px-4 rounded-xl bg-navy text-white font-semibold cursor-pointer whitespace-nowrap"><ImagePlus className="w-4 h-4" /> Upload<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" disabled={uploading} onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0])} /></label></div>{form.hero_image_url && <img src={form.hero_image_url} alt="Hero preview" className="w-full max-h-72 object-cover rounded-2xl border border-black/5" />}</CardContent></Card>

        <Card className="rounded-[24px]"><CardHeader><CardTitle>Benefits & deliverables</CardTitle><p className="text-sm text-gray-500">One item per line.</p></CardHeader><CardContent className="grid md:grid-cols-2 gap-6"><div className="space-y-2"><Label>Benefits</Label><textarea className="w-full min-h-48 rounded-xl border border-input px-4 py-3 text-sm" value={form.benefits} onChange={e => setForm({ ...form, benefits: e.target.value })} /></div><div className="space-y-2"><Label>Deliverables</Label><textarea className="w-full min-h-48 rounded-xl border border-input px-4 py-3 text-sm" value={form.deliverables} onChange={e => setForm({ ...form, deliverables: e.target.value })} /></div></CardContent></Card>

        <Card className="rounded-[24px]"><CardHeader><CardTitle>Visual examples</CardTitle><p className="text-sm text-gray-500">One image per line. Optional format: URL | Title | Caption.</p></CardHeader><CardContent className="space-y-4"><div className="flex gap-3"><Input value="" readOnly placeholder="Upload an image to add it to the gallery" /><label className="inline-flex items-center gap-2 px-4 rounded-xl bg-teal text-navy font-bold cursor-pointer whitespace-nowrap"><ImagePlus className="w-4 h-4" /> Add image<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" disabled={uploading} onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0], true)} /></label></div><textarea className="w-full min-h-56 rounded-xl border border-input px-4 py-3 text-sm font-mono" value={form.gallery_images} onChange={e => setForm({ ...form, gallery_images: e.target.value })} placeholder="https://.../example.jpg | Homepage | Desktop landing page" />{splitLines(form.gallery_images).length > 0 && <div className="grid md:grid-cols-2 gap-4">{splitLines(form.gallery_images).map((line, i) => { const [url] = line.split("|"); return <div key={i} className="relative"><img src={url.trim()} alt="Gallery preview" className="w-full aspect-[4/3] object-cover rounded-2xl border border-black/5" /><button type="button" onClick={() => setForm({ ...form, gallery_images: splitLines(form.gallery_images).filter((_, index) => index !== i).join("\n") })} className="absolute top-2 right-2 w-9 h-9 rounded-full bg-white/90 text-coral grid place-items-center shadow"><Trash2 className="w-4 h-4" /></button></div>})}</div>}</CardContent></Card>

        <Card className="rounded-[24px]"><CardHeader><CardTitle>Process & FAQs</CardTitle><p className="text-sm text-gray-500">One per line using <code>Title | Description</code>.</p></CardHeader><CardContent className="grid md:grid-cols-2 gap-6"><div className="space-y-2"><Label>Process steps</Label><textarea className="w-full min-h-48 rounded-xl border border-input px-4 py-3 text-sm" value={form.process_steps} onChange={e => setForm({ ...form, process_steps: e.target.value })} placeholder="Discover | Understand your goals\nDesign | Create the experience" /></div><div className="space-y-2"><Label>FAQs</Label><textarea className="w-full min-h-48 rounded-xl border border-input px-4 py-3 text-sm" value={form.faqs} onChange={e => setForm({ ...form, faqs: e.target.value })} placeholder="How long does it take? | Timelines depend on scope." /></div></CardContent></Card>

        <div className="sticky bottom-4 flex justify-end gap-3"><Button type="button" variant="outline" asChild className="h-12 rounded-xl bg-white"><Link href={`/services/${form.slug || params.id}`} target="_blank">Preview</Link></Button><Button type="submit" disabled={saving || uploading} className="h-12 px-8 rounded-xl bg-navy font-bold">{saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}Save Details</Button></div>
      </form>
    </div>
  )
}
