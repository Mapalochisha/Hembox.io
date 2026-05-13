"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { 
  Globe, Search, Palette, ShoppingCart, Megaphone, LifeBuoy, Plus, Loader2, 
  Trash2, Eye, EyeOff, X, Code, Smartphone, Rocket, Shield, Zap, Layout, 
  Cpu, Heart, Layers, MessageSquare, Database, Cloud, Lock, BarChart, 
  Target, PenTool, MousePointer2, Camera, GraduationCap, School, Pencil
} from "lucide-react"

const ICON_LIST = [
  { name: "Globe", icon: Globe },
  { name: "Search", icon: Search },
  { name: "Palette", icon: Palette },
  { name: "ShoppingCart", icon: ShoppingCart },
  { name: "Megaphone", icon: Megaphone },
  { name: "LifeBuoy", icon: LifeBuoy },
  { name: "Code", icon: Code },
  { name: "Smartphone", icon: Smartphone },
  { name: "Rocket", icon: Rocket },
  { name: "Shield", icon: Shield },
  { name: "Zap", icon: Zap },
  { name: "Layout", icon: Layout },
  { name: "Cpu", icon: Cpu },
  { name: "Heart", icon: Heart },
  { name: "Layers", icon: Layers },
  { name: "MessageSquare", icon: MessageSquare },
  { name: "Database", icon: Database },
  { name: "Cloud", icon: Cloud },
  { name: "Lock", icon: Lock },
  { name: "BarChart", icon: BarChart },
  { name: "Target", icon: Target },
  { name: "PenTool", icon: PenTool },
  { name: "MousePointer2", icon: MousePointer2 },
  { name: "Camera", icon: Camera },
  { name: "GraduationCap", icon: GraduationCap },
  { name: "School", icon: School }
]

const ICON_MAP: Record<string, any> = ICON_LIST.reduce((acc, curr) => ({ ...acc, [curr.name]: curr.icon }), {})

interface Service {
  id: string
  title: string
  description: string
  icon_name: string
  status: 'active' | 'inactive'
  sort_order: number
}

export default function AdminServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    icon_name: "Globe"
  })

  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    fetchServices()
  }, [])

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('sort_order', { ascending: true })

      if (error) throw error
      setServices(data || [])
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load services.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = (service: Service) => {
    setEditingId(service.id)
    setFormData({
      title: service.title,
      description: service.description,
      icon_name: service.icon_name,
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      if (editingId) {
        // Update
        const { data, error } = await supabase
          .from('services')
          .update(formData)
          .eq('id', editingId)
          .select()

        if (error) throw error
        if (data) {
          setServices(services.map(s => s.id === editingId ? data[0] : s))
          toast({ title: "Service updated successfully", variant: "success" })
        }
      } else {
        // Create
        const { data, error } = await supabase
          .from('services')
          .insert([{ ...formData, status: 'active', sort_order: services.length }])
          .select()

        if (error) throw error
        if (data) {
          setServices([...services, data[0]])
          toast({ title: "Service added successfully", variant: "success" })
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
    setFormData({ title: "", description: "", icon_name: "Globe" })
  }

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    try {
      const { error } = await supabase
        .from('services')
        .update({ status: newStatus })
        .eq('id', id)

      if (error) throw error
      setServices(services.map(s => s.id === id ? { ...s, status: newStatus as any } : s))
      toast({ title: "Status updated" })
    } catch (error: any) {
      toast({ title: "Error", variant: "destructive" })
    }
  }

  const deleteService = async (id: string) => {
    if (!confirm("Are you sure? This service will be removed from your homepage.")) return
    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', id)

      if (error) throw error
      setServices(services.filter(s => s.id !== id))
      toast({ title: "Service deleted" })
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
          <h1 className="text-3xl font-bold tracking-tight text-navy">Service Offerings</h1>
          <p className="text-gray-600 mt-1">Manage the services displayed on your homepage</p>
        </div>
        {!showForm && (
          <Button 
            onClick={() => setShowForm(true)}
            className="bg-teal text-navy font-bold hover:bg-teal/90 gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Service
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="border-teal/30 bg-white relative overflow-hidden rounded-[24px] shadow-xl shadow-teal/5">
          <button 
            onClick={handleCloseForm}
            className="absolute top-4 right-4 text-gray-400 hover:text-navy z-10"
          >
            <X className="w-5 h-5" />
          </button>
          <CardHeader>
            <CardTitle className="text-navy">{editingId ? "Edit Service" : "Add New Service"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-8">
              <div className="grid sm:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-[13px] font-bold uppercase tracking-wider text-gray-500">Service Title</Label>
                    <Input 
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      placeholder="e.g. Web Development"
                      className="h-12 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[13px] font-bold uppercase tracking-wider text-gray-500">Description</Label>
                    <textarea 
                      required
                      className="w-full min-h-[120px] rounded-xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50 transition"
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      placeholder="What does this service include?"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-[13px] font-bold uppercase tracking-wider text-gray-500">Select Icon</Label>
                  <div className="grid grid-cols-6 gap-2 p-4 bg-gray-50 rounded-2xl border border-black/5 h-[240px] overflow-y-auto custom-scrollbar">
                    {ICON_LIST.map((item) => (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => setFormData({...formData, icon_name: item.name})}
                        className={cn(
                          "aspect-square rounded-xl flex items-center justify-center transition-all",
                          formData.icon_name === item.name 
                            ? "bg-teal text-navy scale-110 shadow-lg shadow-teal/20" 
                            : "bg-white text-gray-400 hover:bg-white hover:text-navy border border-black/[0.03]"
                        )}
                      >
                        <item.icon className="w-5 h-5" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="ghost" type="button" onClick={handleCloseForm} className="rounded-xl h-12 px-6">Cancel</Button>
                <Button type="submit" disabled={isSaving} className="bg-navy h-12 px-10 rounded-xl font-bold">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  {editingId ? "Update Service" : "Create Service"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {services.length === 0 ? (
        <Card className="p-12 text-center border-dashed rounded-[24px]">
          <p className="text-gray-500 mb-4">No services found. Add your first service to get started.</p>
          <Button variant="outline" onClick={() => setShowForm(true)}>Add Service</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => {
            const Icon = ICON_MAP[service.icon_name] || Globe
            return (
              <Card key={service.id} className={cn(
                "group hover:border-teal/50 transition-all rounded-[24px] shadow-sm",
                service.status === 'inactive' && "opacity-60"
              )}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="w-10 h-10 rounded-lg bg-teal/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-teal" />
                  </div>
                  <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full K{
                    service.status === 'active' ? 'bg-teal/10 text-teal' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {service.status}
                  </span>
                </CardHeader>
                <CardContent>
                  <CardTitle className="text-[18px] mb-2 group-hover:text-teal transition-colors">{service.title}</CardTitle>
                  <p className="text-[14px] text-gray-500 line-clamp-2 mb-6 h-10">{service.description}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 rounded-lg font-bold" onClick={() => handleEdit(service)}>
                      <Pencil className="w-3.5 h-3.5 mr-2" />
                      Edit
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-gray-400 hover:text-navy"
                      onClick={() => toggleStatus(service.id, service.status)}
                    >
                      {service.status === 'active' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-gray-400 hover:text-coral"
                      onClick={() => deleteService(service.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
