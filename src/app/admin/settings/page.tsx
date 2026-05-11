"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Save, Phone, FileText, Info, ShieldCheck, HelpCircle } from "lucide-react"

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    await new Promise(resolve => setTimeout(resolve, 1000))

    toast({
      title: "Settings saved",
      description: "Your preferences and legal documents have been updated.",
      variant: "success",
    })

    setIsLoading(false)
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
                <Input id="agencyName" defaultValue="Hembox.io" className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail" className="text-[13px] font-bold uppercase tracking-wider text-gray-500">Contact Email</Label>
                <Input id="contactEmail" type="email" defaultValue="hello@Hembox.io" className="rounded-xl" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phoneNumber" className="text-[13px] font-bold uppercase tracking-wider text-gray-500">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input id="phoneNumber" type="tel" defaultValue="+1 (555) 000-0000" className="pl-10 rounded-xl" />
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
                defaultValue="We build fast, beautiful sites that actually convert. No templates. No bloat. Just results."
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
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="rounded-[24px] border-black/5 shadow-sm">
          <CardHeader className="border-b border-black/5">
            <CardTitle className="text-lg">Notification Preferences</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-navy">New client alerts</p>
                <p className="text-sm text-gray-500">Get notified when a new client signs up</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-navy">Project updates</p>
                <p className="text-sm text-gray-500">Daily digest of project activity</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal"></div>
              </label>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" className="bg-navy hover:bg-navy/90 h-14 px-10 rounded-2xl font-bold shadow-xl shadow-navy/10" disabled={isLoading}>
            <Save className="w-5 h-5 mr-3" />
            {isLoading ? "Saving..." : "Save All Settings"}
          </Button>
        </div>
      </form>
    </div>
  )
}
