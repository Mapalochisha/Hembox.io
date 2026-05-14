"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { ImageUpload } from "@/components/admin/image-upload"
import { Plus, ExternalLink, Trash2, Loader2, X, Pencil } from "lucide-react"

interface PortfolioItem {
  id: string
  title: string
  category: string
  image_url: string
  project_url: string
  description: string
  is_featured: boolean
  sort_order: number
}

export default function AdminPortfolioPage() {
  const [items, setItems] = useState<PortfolioItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    title: "",
    category: "Web Development",
    image_url: "",
    project_url: "",
    description: "",
    images: [] as string[]
  })

  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    fetchPortfolio()
  }, [])

  const fetchPortfolio = async () => {
    try {
      const { data, error } = await supabase
        .from('portfolio_items')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setItems(data || [])
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load portfolio items.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = (item: PortfolioItem) => {
    setEditingId(item.id)
    setFormData({
      title: item.title,
      category: item.category,
      image_url: item.image_url,
      project_url: item.project_url || "",
      description: item.description || "",
      images: item.images || []
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.image_url) {
      toast({ title: "Please upload an image", variant: "destructive" })
      return
    }
    setIsSaving(true)

    try {
      if (editingId) {
        // Update
        const { data, error } = await supabase
          .from('portfolio_items')
          .update(formData)
          .eq('id', editingId)
          .select()

        if (error) throw error
        if (data) {
          setItems(items.map(item => item.id === editingId ? data[0] : item))
          toast({ title: "Project updated successfully", variant: "success" })
        }
      } else {
        // Create
        const { data, error } = await supabase
          .from('portfolio_items')
          .insert([{ ...formData, sort_order: items.length }])
          .select()

        if (error) throw error
        if (data) {
          setItems([data[0], ...items])
          toast({ title: "Project added successfully", variant: "success" })
        }
      }
      
      handleCloseForm()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormData({ 
      title: "", 
      category: "Web Development", 
      image_url: "", 
      project_url: "", 
      description: "",
      images: []
    })
  }

  const deleteItem = async (id: string) => {
    if (!confirm("Are you sure? This will permanently remove this project from your portfolio.")) return

    try {
      const { error } = await supabase
        .from('portfolio_items')
        .delete()
        .eq('id', id)

      if (error) throw error
      setItems(items.filter(item => item.id !== id))
      toast({ title: "Project deleted" })
    } catch (error: any) {
      toast({ title: "Error", variant: "destructive" })
    }
  }

  if (isLoading) {
    return (
      <div className="h-[400px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-teal animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-navy">Portfolio</h1>
          <p className="text-gray-600 mt-1">Manage the projects we've done</p>
        </div>
        {!showForm && (
          <Button 
            onClick={() => setShowForm(true)}
            className="bg-coral text-white font-bold hover:bg-coral/90 gap-2 rounded-full px-6 shadow-lg shadow-coral/20"
          >
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="border-navy/10 bg-white relative overflow-hidden rounded-[24px] shadow-2xl shadow-navy/5">
          <button onClick={handleCloseForm} className="absolute top-4 right-4 text-gray-400 hover:text-navy z-10">
            <X className="w-5 h-5" />
          </button>
          <CardHeader>
            <CardTitle className="text-navy">{editingId ? "Edit Project" : "Add Portfolio Project"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="grid md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-[13px] font-bold uppercase tracking-wider text-gray-500">Project Title</Label>
                  <Input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. EcoStore E-commerce" className="h-12 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[13px] font-bold uppercase tracking-wider text-gray-500">Category</Label>
                  <Input required value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} placeholder="e.g. Web Development" className="h-12 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[13px] font-bold uppercase tracking-wider text-gray-500">Project URL (Optional)</Label>
                  <Input value={formData.project_url} onChange={e => setFormData({...formData, project_url: e.target.value})} placeholder="https://..." className="h-12 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[13px] font-bold uppercase tracking-wider text-gray-500">Description</Label>
                  <textarea 
                    required 
                    className="w-full min-h-[120px] rounded-xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 transition"
                    value={formData.description} 
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    placeholder="Briefly describe the project and what we achieved..."
                  />
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <Label className="text-[13px] font-bold uppercase tracking-wider text-gray-500 mb-3 block">Cover Image</Label>
                  <ImageUpload 
                    value={formData.image_url} 
                    onChange={url => setFormData({...formData, image_url: url})} 
                    onRemove={() => setFormData({...formData, image_url: ""})} 
                  />
                </div>

                <div>
                  <Label className="text-[13px] font-bold uppercase tracking-wider text-gray-500 mb-3 block">Additional Screenshots</Label>
                  <div className="grid grid-cols-2 gap-4">
                    {formData.images.map((url, i) => (
                      <div key={i} className="relative aspect-video rounded-xl overflow-hidden border border-black/5 group">
                        <img src={url} alt={`Screenshot ${i+1}`} className="w-full h-full object-cover" />
                        <button 
                          type="button"
                          onClick={() => setFormData({...formData, images: formData.images.filter((_, idx) => idx !== i)})}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-navy/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <div className="aspect-video">
                      <ImageUpload 
                        value="" 
                        onChange={url => setFormData({...formData, images: [...formData.images, url]})} 
                        onRemove={() => {}} 
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 justify-end pt-4">
                  <Button variant="ghost" type="button" onClick={handleCloseForm} className="rounded-xl h-12 px-6">Cancel</Button>
                  <Button type="submit" disabled={isSaving} className="bg-navy h-12 px-10 rounded-xl font-bold text-white shadow-lg shadow-navy/10">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                    {editingId ? "Update Project" : "Save Project"}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {items.length === 0 ? (
        <Card className="p-12 text-center border-dashed rounded-[32px]">
          <p className="text-gray-500 mb-4">No portfolio items found. Showcase your work here.</p>
          <Button variant="outline" onClick={() => setShowForm(true)} className="rounded-xl">Add Your First Project</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {items.map((project) => (
            <Card key={project.id} className="overflow-hidden rounded-[32px] border-black/5 hover:shadow-2xl transition-all group bg-white">
              <div className="h-56 relative overflow-hidden">
                <img src={project.image_url} alt={project.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute top-5 left-5">
                  <span className="px-4 py-1.5 bg-white/95 backdrop-blur-md rounded-full text-[11px] font-black text-navy uppercase tracking-[0.1em] shadow-sm">
                    {project.category}
                  </span>
                </div>
              </div>
              <CardContent className="p-8">
                <div className="flex items-center justify-between mb-4">
                  <CardTitle className="text-2xl font-black text-navy tracking-tight">{project.title}</CardTitle>
                  <div className="flex gap-2">
                    {project.project_url && (
                      <a href={project.project_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-teal/10 hover:text-teal transition-colors">
                          <ExternalLink className="w-5 h-5" />
                        </Button>
                      </a>
                    )}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-10 w-10 rounded-full hover:bg-navy/10 hover:text-navy transition-colors"
                      onClick={() => handleEdit(project)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-10 w-10 rounded-full hover:bg-coral/10 hover:text-coral transition-colors" 
                      onClick={() => deleteItem(project.id)}
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
                <p className="text-[15px] text-gray-500 leading-relaxed line-clamp-3 mb-8">{project.description}</p>
                <Button 
                  variant="outline" 
                  className="w-full h-12 rounded-2xl border-gray-100 hover:bg-navy hover:text-white hover:border-navy transition-all font-bold"
                  onClick={() => handleEdit(project)}
                >
                  Edit Project Details
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
