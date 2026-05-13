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
  Plus, Loader2, Trash2, Eye, EyeOff, X, Pencil, DollarSign, Check, 
  ArrowUpDown, Star
} from "lucide-react"

interface PricingPackage {
  id: string
  name: string
  description: string
  price_amount: number
  price_suffix: string
  features: string[]
  status: 'active' | 'inactive'
  is_popular: boolean
  sort_order: number
}

export default function AdminPricingPage() {
  const [packages, setPackages] = useState<PricingPackage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price_amount: 0,
    price_suffix: "/project",
    features: [""] as string[],
    is_popular: false
  })

  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    fetchPackages()
  }, [])

  const fetchPackages = async () => {
    try {
      const { data, error } = await supabase
        .from('pricing_packages')
        .select('*')
        .order('sort_order', { ascending: true })

      if (error) throw error
      setPackages(data || [])
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load pricing packages.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = (pkg: PricingPackage) => {
    setEditingId(pkg.id)
    setFormData({
      name: pkg.name,
      description: pkg.description || "",
      price_amount: pkg.price_amount,
      price_suffix: pkg.price_suffix || "/project",
      features: pkg.features && pkg.features.length > 0 ? pkg.features : [""],
      is_popular: pkg.is_popular
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    // Filter out empty features
    const cleanFeatures = formData.features.filter(f => f.trim() !== "")

    try {
      if (editingId) {
        const { data, error } = await supabase
          .from('pricing_packages')
          .update({ ...formData, features: cleanFeatures })
          .eq('id', editingId)
          .select()

        if (error) throw error
        if (data) {
          setPackages(packages.map(p => p.id === editingId ? data[0] : p))
          toast({ title: "Package updated successfully", variant: "success" })
        }
      } else {
        const { data, error } = await supabase
          .from('pricing_packages')
          .insert([{ 
            ...formData, 
            features: cleanFeatures,
            status: 'active', 
            sort_order: packages.length 
          }])
          .select()

        if (error) throw error
        if (data) {
          setPackages([...packages, data[0]])
          toast({ title: "Package created successfully", variant: "success" })
        }
      }
      
      handleCloseForm()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormData({ 
      name: "", 
      description: "", 
      price_amount: 0, 
      price_suffix: "/project", 
      features: [""],
      is_popular: false 
    })
  }

  const updateFeature = (index: number, value: string) => {
    const newFeatures = [...formData.features]
    newFeatures[index] = value
    setFormData({ ...formData, features: newFeatures })
  }

  const addFeatureField = () => {
    setFormData({ ...formData, features: [...formData.features, ""] })
  }

  const removeFeatureField = (index: number) => {
    const newFeatures = formData.features.filter((_, i) => i !== index)
    setFormData({ ...formData, features: newFeatures.length > 0 ? newFeatures : [""] })
  }

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    try {
      const { error } = await supabase
        .from('pricing_packages')
        .update({ status: newStatus })
        .eq('id', id)

      if (error) throw error
      setPackages(packages.map(p => p.id === id ? { ...p, status: newStatus as any } : p))
      toast({ title: "Status updated" })
    } catch (error: any) {
      toast({ title: "Error", variant: "destructive" })
    }
  }

  const deletePackage = async (id: string) => {
    if (!confirm("Are you sure? This package will be removed from your pricing page.")) return
    try {
      const { error } = await supabase
        .from('pricing_packages')
        .delete()
        .eq('id', id)

      if (error) throw error
      setPackages(packages.filter(p => p.id !== id))
      toast({ title: "Package deleted" })
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
          <h1 className="text-3xl font-bold tracking-tight text-navy">Pricing Packages</h1>
          <p className="text-gray-600 mt-1">Manage the service tiers offered to your clients</p>
        </div>
        {!showForm && (
          <Button 
            onClick={() => setShowForm(true)}
            className="bg-navy text-white font-bold hover:bg-navy/90 gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Package
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="border-navy/10 bg-white relative overflow-hidden rounded-[24px] shadow-xl shadow-navy/5">
          <button 
            onClick={handleCloseForm}
            className="absolute top-4 right-4 text-gray-400 hover:text-navy z-10"
          >
            <X className="w-5 h-5" />
          </button>
          <CardHeader>
            <CardTitle className="text-navy">{editingId ? "Edit Package" : "Create New Package"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-8">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-[13px] font-bold uppercase tracking-wider text-gray-500">Package Name</Label>
                    <Input 
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="e.g. Starter, Professional, Enterprise"
                      className="h-12 rounded-xl"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[13px] font-bold uppercase tracking-wider text-gray-500">Starting Price</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input 
                          type="number"
                          required
                          value={formData.price_amount}
                          onChange={(e) => setFormData({...formData, price_amount: Number(e.target.value)})}
                          className="h-12 rounded-xl pl-10"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[13px] font-bold uppercase tracking-wider text-gray-500">Suffix</Label>
                      <Input 
                        value={formData.price_suffix}
                        onChange={(e) => setFormData({...formData, price_suffix: e.target.value})}
                        placeholder="/project or /month"
                        className="h-12 rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[13px] font-bold uppercase tracking-wider text-gray-500">Description</Label>
                    <textarea 
                      required
                      className="w-full min-h-[80px] rounded-xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50 transition"
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      placeholder="Short tagline for this tier..."
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <input 
                      type="checkbox" 
                      id="isPopular" 
                      checked={formData.is_popular} 
                      onChange={e => setFormData({...formData, is_popular: e.target.checked})}
                      className="w-4 h-4 text-teal rounded border-gray-300 focus:ring-teal"
                    />
                    <Label htmlFor="isPopular" className="text-sm font-medium">Mark as Most Popular</Label>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-[13px] font-bold uppercase tracking-wider text-gray-500">Included Features</Label>
                    <Button type="button" variant="ghost" size="sm" onClick={addFeatureField} className="text-teal font-bold h-7 px-2">
                      <Plus className="w-3 h-3 mr-1" /> Add
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar">
                    {formData.features.map((feature, index) => (
                      <div key={index} className="flex gap-2">
                        <Input 
                          value={feature}
                          onChange={(e) => updateFeature(index, e.target.value)}
                          placeholder="e.g. 3 Pages Design"
                          className="rounded-lg h-10"
                        />
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => removeFeatureField(index)}
                          className="text-gray-400 hover:text-coral h-10 w-10 shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-black/5">
                <Button variant="ghost" type="button" onClick={handleCloseForm} className="rounded-xl h-12 px-6">Cancel</Button>
                <Button type="submit" disabled={isSaving} className="bg-navy h-12 px-10 rounded-xl font-bold text-white">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                  {editingId ? "Update Tier" : "Create Package"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {packages.length === 0 ? (
        <Card className="p-12 text-center border-dashed rounded-[24px]">
          <p className="text-gray-500 mb-4">No pricing packages found.</p>
          <Button variant="outline" onClick={() => setShowForm(true)}>Add Your First Tier</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {packages.map((pkg) => (
            <Card key={pkg.id} className={cn(
              "group hover:border-teal/50 transition-all rounded-[24px] shadow-sm relative",
              pkg.status === 'inactive' && "opacity-60",
              pkg.is_popular && "border-teal/50 ring-1 ring-teal/20"
            )}>
              {pkg.is_popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-teal text-[#0F172A] text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg">
                  Most Popular
                </div>
              )}
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full K{
                    pkg.status === 'active' ? 'bg-teal/10 text-teal' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {pkg.status}
                  </span>
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 rounded-full hover:bg-navy/10"
                      onClick={() => toggleStatus(pkg.id, pkg.status)}
                      title="Hide/Show on site"
                    >
                      {pkg.status === 'active' ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 rounded-full hover:bg-coral/10 hover:text-coral" 
                      onClick={() => deletePackage(pkg.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <CardTitle className="text-2xl font-black text-navy">{pkg.name}</CardTitle>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl font-black text-navy">K{pkg.price_amount.toLocaleString()}</span>
                  <span className="text-[14px] text-gray-500 font-medium">{pkg.price_suffix}</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-[14px] text-gray-500 mb-6 line-clamp-2 h-10">{pkg.description}</p>
                <div className="space-y-2 mb-8">
                  {pkg.features?.slice(0, 3).map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-[13px] text-gray-600">
                      <div className="w-4 h-4 rounded-full bg-teal/10 flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 text-teal" />
                      </div>
                      <span className="truncate">{f}</span>
                    </div>
                  ))}
                  {pkg.features?.length > 3 && (
                    <p className="text-[12px] text-gray-400 pl-6">+{pkg.features.length - 3} more features</p>
                  )}
                </div>
                <Button 
                  variant="outline" 
                  className="w-full h-10 rounded-xl border-gray-100 hover:bg-navy hover:text-white transition-all font-bold"
                  onClick={() => handleEdit(pkg)}
                >
                  <Pencil className="w-3.5 h-3.5 mr-2" />
                  Edit Tier
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
