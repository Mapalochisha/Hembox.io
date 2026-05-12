"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { ImageUpload } from "@/components/admin/image-upload"
import { Plus, ExternalLink, Trash2, Loader2, X } from "lucide-react"

interface PortfolioItem {
  id: string
  title: string
  category: string
  image_url: string
  project_url: string
  description: string
  is_featured: boolean
}

export default function AdminPortfolioPage() {
  const [items, setItems] = useState<PortfolioItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [newItem, setNewItem] = useState({
    title: "",
    category: "Web Development",
    image_url: "",
    project_url: "",
    description: "",
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

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItem.image_url) {
      toast({ title: "Please upload an image", variant: "destructive" })
      return
    }
    setIsSaving(true)

    try {
      const { data, error } = await supabase
        .from('portfolio_items')
        .insert([newItem])
        .select()

      if (error) throw error
      if (data) {
        setItems([data[0], ...items])
        setShowAddForm(false)
        setNewItem({ title: "", category: "Web Development", image_url: "", project_url: "", description: "" })
        toast({ title: "Project added successfully", variant: "success" })
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const deleteItem = async (id: string) => {
    if (!confirm("Are you sure?")) return

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
        <Button 
          onClick={() => setShowAddForm(true)}
          className="bg-coral text-white font-bold hover:bg-coral/90 gap-2 rounded-full px-6 shadow-lg shadow-coral/20"
        >
          <Plus className="w-4 h-4" />
          New Project
        </Button>
      </div>

      {showAddForm && (
        <Card className="border-coral/20 bg-coral/5 relative overflow-hidden rounded-[24px]">
          <button onClick={() => setShowAddForm(false)} className="absolute top-4 right-4 text-gray-400 hover:text-navy">
            <X className="w-5 h-5" />
          </button>
          <CardHeader><CardTitle>Add Portfolio Project</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleAddItem} className="grid md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>Project Title</Label>
                  <Input required value={newItem.title} onChange={e => setNewItem({...newItem, title: e.target.value})} placeholder="e.g. EcoStore E-commerce" />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input required value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} placeholder="e.g. Web Development" />
                </div>
                <div className="space-y-2">
                  <Label>Project URL (Optional)</Label>
                  <Input value={newItem.project_url} onChange={e => setNewItem({...newItem, project_url: e.target.value})} placeholder="https://..." />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <textarea 
                    required 
                    className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={newItem.description} 
                    onChange={e => setNewItem({...newItem, description: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-6">
                <Label>Cover Image</Label>
                <ImageUpload 
                  value={newItem.image_url} 
                  onChange={url => setNewItem({...newItem, image_url: url})} 
                  onRemove={() => setNewItem({...newItem, image_url: ""})} 
                />
                <div className="flex gap-3 justify-end pt-4">
                  <Button variant="ghost" type="button" onClick={() => setShowAddForm(false)}>Cancel</Button>
                  <Button type="submit" disabled={isSaving} className="bg-navy h-12 px-8">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                    Save Project
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {items.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <p className="text-gray-500 mb-4">No portfolio items found.</p>
          <Button variant="outline" onClick={() => setShowAddForm(true)}>Add Your First Project</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {items.map((project) => (
            <Card key={project.id} className="overflow-hidden rounded-[24px] border-black/5 hover:shadow-xl transition-all group">
              <div className="h-48 relative">
                <img src={project.image_url} alt={project.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
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
                    {project.project_url && (
                      <a href={project.project_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-teal/10 hover:text-teal">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </a>
                    )}
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-coral/10 hover:text-coral" onClick={() => deleteItem(project.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-[14px] text-gray-500 line-clamp-2 mb-6">{project.description}</p>
                <Button variant="outline" className="w-full rounded-xl border-gray-200">Edit Project Details</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
