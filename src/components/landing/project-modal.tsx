"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { X, ExternalLink, ChevronLeft, ChevronRight, Globe } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

interface ProjectSummary {
  id: string
  title: string
  category: string
  image_url: string
}

interface ProjectDetails extends ProjectSummary {
  project_url?: string
  description?: string
  images?: string[]
}

export function ProjectModal({ project, onClose }: { project: ProjectSummary | null; onClose: () => void }) {
  const [activeImage, setActiveImage] = useState(0)
  const [details, setDetails] = useState<ProjectDetails | null>(null)
  const supabase = createClient()

  useEffect(() => {
    setActiveImage(0)
    setDetails(null)

    if (!project) return

    const fetchDetails = async () => {
      const { data } = await supabase
        .from("portfolio_items")
        .select("id,title,category,image_url,project_url,description,images")
        .eq("id", project.id)
        .maybeSingle()

      if (data) setDetails(data)
    }

    fetchDetails()
  }, [project])

  if (!project) return null

  const currentProject = details || project
  const allImages = details?.images && details.images.length > 0 ? details.images : [project.image_url]

  const nextImage = () => setActiveImage((prev) => (prev + 1) % allImages.length)
  const prevImage = () => setActiveImage((prev) => (prev - 1 + allImages.length) % allImages.length)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-navy/80 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose} />

      <div className="relative w-full max-w-5xl bg-white rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 fade-in duration-300 flex flex-col md:flex-row h-fit max-h-[90vh]">
        <div className="relative w-full md:w-3/5 bg-gray-100 aspect-video md:aspect-auto overflow-hidden">
          <Image src={allImages[activeImage]} alt={currentProject.title} fill sizes="(max-width: 768px) 100vw, 60vw" className="object-cover" />

          {allImages.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); prevImage() }} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 shadow-lg flex items-center justify-center hover:bg-white transition">
                <ChevronLeft className="w-6 h-6 text-navy" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); nextImage() }} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 shadow-lg flex items-center justify-center hover:bg-white transition">
                <ChevronRight className="w-6 h-6 text-navy" />
              </button>
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                {allImages.map((_, i) => (
                  <button key={i} onClick={(e) => { e.stopPropagation(); setActiveImage(i) }} className={cn("w-2 h-2 rounded-full transition-all", activeImage === i ? "bg-white w-6" : "bg-white/40")} />
                ))}
              </div>
            </>
          )}

          <button onClick={onClose} className="md:hidden absolute top-4 right-4 w-10 h-10 rounded-full bg-navy/20 backdrop-blur-sm text-white flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="w-full md:w-2/5 p-8 sm:p-12 flex flex-col overflow-y-auto custom-scrollbar">
          <div className="flex items-start justify-between mb-8">
            <div>
              <p className="text-[13px] font-bold text-teal uppercase tracking-[0.2em] mb-2">{currentProject.category}</p>
              <h3 className="text-[28px] sm:text-[32px] font-black text-navy leading-tight">{currentProject.title}</h3>
            </div>
            <button onClick={onClose} className="hidden md:flex w-10 h-10 items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 transition">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1">
            <h4 className="text-[14px] font-bold text-navy uppercase tracking-wider mb-3">About the project</h4>
            <p className="text-gray-600 leading-relaxed text-[16px] mb-8 whitespace-pre-wrap">
              {details?.description || "Loading project details..."}
            </p>
          </div>

          {details?.project_url && (
            <div className="pt-8 border-t border-black/5">
              <a href={details.project_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-[15px] font-bold text-navy hover:text-teal transition group">
                <Globe className="w-5 h-5 text-teal" />
                Visit Live Site
                <ExternalLink className="w-4 h-4 ml-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </a>
            </div>
          )}

          <Button onClick={onClose} className="mt-10 w-full h-14 rounded-2xl bg-navy text-white font-bold hover:bg-navy/90 md:hidden">Close Details</Button>
        </div>
      </div>
    </div>
  )
}
