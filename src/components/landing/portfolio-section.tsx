"use client"

import { ArrowUpRight } from "lucide-react"

const projects = [
  {
    title: "EcoStore E-commerce",
    category: "Web Development",
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=800",
    color: "bg-teal/20",
  },
  {
    title: "Luxe Real Estate",
    category: "UI/UX Design",
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=800",
    color: "bg-coral/20",
  },
  {
    title: "HealthTrack App",
    category: "Mobile Solutions",
    image: "https://images.unsplash.com/photo-1504868584819-f8e90526ef49?auto=format&fit=crop&q=80&w=800",
    color: "bg-navy/20",
  },
  {
    title: "Modern Portfolio",
    category: "Branding",
    image: "https://images.unsplash.com/photo-1522542550221-31fd19575a2d?auto=format&fit=crop&q=80&w=800",
    color: "bg-teal/20",
  },
]

export function PortfolioSection() {
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
            <div key={index} className="group cursor-pointer">
              <div className={`relative aspect-[4/3] rounded-[32px] overflow-hidden ${project.color} mb-6`}>
                <img 
                  src={project.image} 
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
    </section>
  )
}
