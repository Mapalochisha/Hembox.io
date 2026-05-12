"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { 
  Globe, 
  Search, 
  Palette, 
  ShoppingCart, 
  Megaphone, 
  LifeBuoy, 
  Plus, 
  Loader2,
  Trash2,
  Eye,
  EyeOff,
  X
} from "lucide-react"

const ICON_MAP: Record<string, any> = {
  Globe,
  Search,
  Palette,
  ShoppingCart,
  Megaphone,
  LifeBuoy,
}

interface Service {
  id: string
  title: string
  description: string
  icon_name: string
  status: 'active' | 'inactive'
}

export default function AdminServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [showAddForm, setShowAddAddForm] = useState(false)
  
  const [newService, setNewService] = useState({
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

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsAdding(true)

    try {
      const { data, error } = await supabase
        .from('services')
        .insert([{
          ...newService,
          status: 'active',
          sort_order: services.length
        }])
        .select()

      if (error) throw error

      if (data) {
        setServices([...services, data[0]])
        setShowAddAddForm(false)
        setNewService({ title: "", description: "", icon_name: "Globe" })
        toast({
          title: "Service added",
          variant: "success",
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsAdding(false)
    }
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
      
      toast({
        title: "Status updated",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        variant: "destructive",
      })
    }
  }

  const deleteService = async (id: string) => {
    if (!confirm("Are you sure?")) return

    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', id)

      if (error) throw error

      setServices(services.filter(s => s.id !== id))
      toast({
        title: "Service deleted",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        variant: "destructive",
      })
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
        <Button 
          onClick={() => setShowAddAddForm(true)}
          className="bg-teal text-navy font-bold hover:bg-teal/90 gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Service
        </Button>
      </div>

      {showAddForm && (
        <Card className="border-teal/30 bg-teal/5 relative overflow-hidden rounded-[24px]">
          <button 
            onClick={() => setShowAddAddForm(false)}
            className="absolute top-4 right-4 text-gray-400 hover:text-navy"
          >
            <X className="w-5 h-5" />
          </button>
          <CardHeader>
            <CardTitle>Add New Service</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddService} className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Service Title</Label>
                  <Input 
                    required
                    value={newService.title}
                    onChange={(e) => setNewService({...newService, title: e.target.value})}
                    placeholder="e.g. Web Development"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Icon</Label>
                  <select 
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50"
                    value={newService.icon_name}
                    onChange={(e) => setNewService({...newService, icon_name: e.target.value})}
                  >
                    {Object.keys(ICON_MAP).map(icon => (
                      <option key={icon} value={icon}>{icon}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <textarea 
                  required
                  className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50"
                  value={newService.description}
                  onChange={(e) => setNewService({...newService, description: e.target.value})}
                  placeholder="What does this service include?"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="ghost" type="button" onClick={() => setShowAddAddForm(false)}>Cancel</Button>
                <Button type="submit" disabled={isAdding} className="bg-navy">
                  {isAdding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Create Service
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {services.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <p className="text-gray-500 mb-4">No services found. Add your first service to get started.</p>
          <Button variant="outline" onClick={() => setShowAddAddForm(true)}>Add Service</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => {
            const Icon = ICON_MAP[service.icon_name] || Globe
            return (
              <Card key={service.id} className={cn(
                "group hover:border-teal/50 transition-all rounded-[24px]",
                service.status === 'inactive' && "opacity-60"
              )}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="w-10 h-10 rounded-lg bg-teal/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-teal" />
                  </div>
                  <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    service.status === 'active' ? 'bg-teal/10 text-teal' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {service.status}
                  </span>
                </CardHeader>
                <CardContent>
                  <CardTitle className="text-[18px] mb-2 group-hover:text-teal transition-colors">{service.title}</CardTitle>
                  <p className="text-[14px] text-gray-500 line-clamp-2 mb-6">{service.description}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 rounded-lg">Edit</Button>
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

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ")
}
