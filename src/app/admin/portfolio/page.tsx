"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, ExternalLink, Trash2 } from "lucide-react"

const projects = [
  { title: "EcoStore E-commerce", category: "Web Development", image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=800" },
  { title: "Luxe Real Estate", category: "UI/UX Design", image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=800" },
  { title: "HealthTrack App", category: "Mobile Solutions", image: "https://images.unsplash.com/photo-1504868584819-f8e90526ef49?auto=format&fit=crop&q=80&w=800" },
  { title: "Modern Portfolio", category: "Branding", image: "https://images.unsplash.com/photo-1522542550221-31fd19575a2d?auto=format&fit=crop&q=80&w=800" },
]

export default function AdminPortfolioPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-navy">Portfolio</h1>
          <p className="text-gray-600 mt-1">Manage the projects we've done</p>
        </div>
        <Button className="bg-coral text-white font-bold hover:bg-coral/90 gap-2 rounded-full px-6 shadow-lg shadow-coral/20">
          <Plus className="w-4 h-4" />
          New Project
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {projects.map((project, index) => (
          <Card key={index} className="overflow-hidden rounded-[24px] border-black/5 hover:shadow-xl transition-all group">
            <div className="h-48 relative">
              <img src={project.image} alt={project.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute top-4 left-4">
                <span className="px-3 py-1 bg-white/90 backdrop-blur-md rounded-full text-[12px] font-bold text-navy uppercase tracking-wider">
                  {project.category}
                </span>
              </div>
            </div>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <CardTitle className="text-xl font-bold text-navy">{project.title}</CardTitle>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-teal/10 hover:text-teal">
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-coral/10 hover:text-coral">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <Button variant="outline" className="w-full rounded-xl border-gray-200">Edit Project Details</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
