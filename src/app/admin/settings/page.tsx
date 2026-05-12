"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { Save, Phone, FileText, Info, ShieldCheck, HelpCircle, Loader2 } from "lucide-react"

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [settings, setSettings] = useState({
    agency_name: "",
    contact_email: "",
    phone_number: "",
    about_us_content: "",
    terms_conditions: "",
    privacy_policy: ""
  })
  
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('agency_settings')
        .select('*')
        .single()

      if (error) throw error
      if (data) {
        setSettings({
          agency_name: data.agency_name || "",
          contact_email: data.contact_email || "",
          phone_number: data.phone_number || "",
          about_us_content: data.about_us_content || "",
          terms_conditions: data.terms_conditions || "",
          privacy_policy: data.privacy_policy || ""
        })
      }
    } catch (error: any) {
      console.error("Error fetching settings:", error)
      toast({
        title: "Error",
        description: "Failed to load settings from database.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      const { error } = await supabase
        .from('agency_settings')
        .update({
          ...settings,
          updated_at: new Date().toISOString()
        })
        .eq('agency_name', 'Hembox.io') // Update by known name or use ID if preferred

      if (error) throw error

      toast({
        title: "Settings saved",
        description: "Your preferences and legal documents have been updated.",
        variant: "success",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
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
    <div className="space-y-8 pb-20">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-navy">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your agency profile, contact details, and legal documents.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-8 max-w-4xl">
        {/* Agency Profile */}
        <Card className="rounded-[24px] border-black/5 shadow-sm">
          <CardHeader className="border-b border-black/5">
            <CardTitle className="text-lg flex items-center gap-2">
              <Info className="w-5 h-5 text-teal" />
              Agency Information
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="agencyName" className="text-[13px] font-bold uppercase tracking-wider text-gray-500">Agency Name</Label>
                <Input 
                  id="agencyName" 
                  value={settings.agency_name} 
                  onChange={(e) => setSettings({...settings, agency_name: e.target.value})}
                  className="rounded-xl" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail" className="text-[13px] font-bold uppercase tracking-wider text-gray-500">Contact Email</Label>
                <Input 
                  id="contactEmail" 
                  type="email" 
                  value={settings.contact_email} 
                  onChange={(e) => setSettings({...settings, contact_email: e.target.value})}
                  className="rounded-xl" 
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phoneNumber" className="text-[13px] font-bold uppercase tracking-wider text-gray-500">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                  id="phoneNumber" 
                  type="tel" 
                  value={settings.phone_number} 
                  onChange={(e) => setSettings({...settings, phone_number: e.target.value})}
                  className="pl-10 rounded-xl" 
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Legal & About Us */}
        <Card className="rounded-[24px] border-black/5 shadow-sm">
          <CardHeader className="border-b border-black/5">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-coral" />
              Content & Legal Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-8">
            <div className="space-y-3">
              <Label htmlFor="aboutUs" className="text-[13px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                <HelpCircle className="w-4 h-4" /> About Us Content
              </Label>
              <textarea 
                id="aboutUs"
                rows={4}
                className="w-full min-h-[120px] rounded-xl border border-black/10 p-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-teal/50 transition"
                placeholder="Describe your agency..."
                value={settings.about_us_content}
                onChange={(e) => setSettings({...settings, about_us_content: e.target.value})}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-8">
              <div className="space-y-3">
                <Label htmlFor="terms" className="text-[13px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" /> Terms & Conditions
                </Label>
                <textarea 
                  id="terms"
                  rows={6}
                  className="w-full min-h-[150px] rounded-xl border border-black/10 p-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-teal/50 transition"
                  placeholder="Paste terms here..."
                  value={settings.terms_conditions}
                  onChange={(e) => setSettings({...settings, terms_conditions: e.target.value})}
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="privacy" className="text-[13px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" /> Privacy Policy
                </Label>
                <textarea 
                  id="privacy"
                  rows={6}
                  className="w-full min-h-[150px] rounded-xl border border-black/10 p-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-teal/50 transition"
                  placeholder="Paste privacy policy here..."
                  value={settings.privacy_policy}
                  onChange={(e) => setSettings({...settings, privacy_policy: e.target.value})}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" className="bg-navy hover:bg-navy/90 h-14 px-10 rounded-2xl font-bold shadow-xl shadow-navy/10" disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="w-5 h-5 mr-3 animate-spin" />
            ) : (
              <Save className="w-5 h-5 mr-3" />
            )}
            {isSaving ? "Saving..." : "Save All Settings"}
          </Button>
        </div>
      </form>
    </div>
  )
}
