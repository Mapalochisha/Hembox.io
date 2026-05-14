"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { ArrowUpRight } from "lucide-react"
import { ProjectModal } from "./project-modal"

interface PortfolioItem {
  id: string
  title: string
  category: string
  image_url: string
  project_url?: string
  description?: string
  images?: string[]
}

export function PortfolioSection() {
  const [projects, setProjects] = useState<PortfolioItem[]>([])
  const [selectedProject, setSelectedProject] = useState<PortfolioItem | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const fetchPortfolio = async () => {
      const { data } = await supabase
        .from('portfolio_items')
        .select('*')
        .order('sort_order', { ascending: true })
      
      if (data) setProjects(data)
    }

    fetchPortfolio()
  }, [])

  if (projects.length === 0) return null

  return (
    <section id="work" className="py-24 relative overflow-hidden">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div className="max-w-2xl">
            <h2 className="text-[13px] font-bold tracking-[0.2em] text-coral uppercase mb-3">Our Work</h2>
            <h3 className="text-[32px] sm:text-[40px] font-black tracking-tight text-navy leading-tight">
              Crafting <span className="text-teal">digital experiences</span> that matter.
            </h3>
          </div>
          <button className="h-[52px] px-8 rounded-full border border-gray-200 font-semibold text-[15px] hover:bg-gray-50 transition shrink-0">
            View All Projects
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-8">
          {projects.map((project, index) => (
            <div 
              key={project.id} 
              className="group cursor-pointer"
              onClick={() => setSelectedProject(project)}
            >
              <div className={`relative aspect-[4/3] rounded-[32px] overflow-hidden bg-gray-100 mb-6`}>
                <img 
                  src={project.image_url} 
                  alt={project.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-navy/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-white grid place-items-center translate-y-4 group-hover:translate-y-0 transition-transform">
                    <ArrowUpRight className="w-6 h-6 text-navy" />
                  </div>
                </div>
              </div>
              <p className="text-[14px] font-bold text-teal uppercase tracking-wider mb-2">{project.category}</p>
              <h4 className="text-[24px] font-black text-navy">{project.title}</h4>
            </div>
          ))}
        </div>
      </div>

      <ProjectModal 
        project={selectedProject} 
        onClose={() => setSelectedProject(null)} 
      />
    </section>
  )
}
