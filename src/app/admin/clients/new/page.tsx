"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"

export default function NewClientPage() {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)

    try {
      const email = formData.get("email") as string
      let userId = null

      if (email) {
        const { data: existingUser } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", email)
          .single()

        if (existingUser) {
          userId = existingUser.id
        }
      }

      const { error: clientError } = await supabase.from("clients").insert({
        user_id: userId,
        company_name: formData.get("company_name"),
        industry: formData.get("industry"),
        website: formData.get("website"),
        status: formData.get("status") || "pending",
        notes: formData.get("notes"),
      })

      if (clientError) throw clientError

      toast({
        title: "Client created!",
        description: "The client has been added successfully.",
        variant: "success",
      })

      router.push("/admin/clients")
      router.refresh()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create client",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <Link href="/admin/clients" className="text-sm text-gray-500 hover:text-navy flex items-center gap-1 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to clients
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Add New Client</h1>
        <p className="text-gray-600 mt-1">Create a new client record</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Client Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input id="full_name" name="full_name" placeholder="John Doe" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" placeholder="john@company.com" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name</Label>
              <Input id="company_name" name="company_name" placeholder="Acme Inc." />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Input id="industry" name="industry" placeholder="Technology" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input id="website" name="website" placeholder="https://example.com" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-teal/30 focus:border-teal outline-none"
              >
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                name="notes"
                rows={4}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-teal/30 focus:border-teal outline-none resize-none"
                placeholder="Additional notes about this client..."
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" className="bg-navy hover:bg-navy/90" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Create Client
              </Button>
              <Link href="/admin/clients">
                <Button variant="outline">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}