import { createServiceClient } from "@/lib/supabase/service"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, Mail, Phone, Globe, MoreHorizontal } from "lucide-react"
import Link from "next/link"

async function getClients(search?: string) {
  const supabase = createServiceClient()

  let query = supabase
    .from("clients")
    .select("*, profiles(full_name, email, phone)")
    .order("created_at", { ascending: false })

  if (search) {
    query = query.or(`company_name.ilike.%${search}%,profiles.full_name.ilike.%${search}%`)
  }

  const { data, error } = await query

  if (error) {
    console.error("Error fetching clients:", error)
    return []
  }

  return data || []
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: { search?: string }
}) {
  const clients = await getClients(searchParams.search)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-gray-600 mt-1">Manage your client relationships</p>
        </div>
        <Link href="/admin/clients/new">
          <Button className="bg-navy hover:bg-navy/90">
            <Plus className="w-4 h-4 mr-2" />
            Add Client
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <form>
                <Input
                  name="search"
                  placeholder="Search clients..."
                  defaultValue={searchParams.search}
                  className="pl-10"
                />
              </form>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Client</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Company</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Contact</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Industry</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client: any) => (
                  <tr key={client.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-navy/10 grid place-items-center text-xs font-bold text-navy">
                          {client.profiles?.full_name?.charAt(0) || client.profiles?.email?.charAt(0) || "C"}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{client.profiles?.full_name || "Unknown"}</p>
                          <p className="text-xs text-gray-500">{client.profiles?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm">{client.company_name || "—"}</td>
                    <td className="py-4 px-4">
                      <div className="flex gap-2">
                        {client.profiles?.email && (
                          <a href={`mailto:${client.profiles.email}`} className="text-gray-400 hover:text-navy transition">
                            <Mail className="w-4 h-4" />
                          </a>
                        )}
                        {client.profiles?.phone && (
                          <a href={`tel:${client.profiles.phone}`} className="text-gray-400 hover:text-navy transition">
                            <Phone className="w-4 h-4" />
                          </a>
                        )}
                        {client.website && (
                          <a href={client.website} target="_blank" rel="noopener" className="text-gray-400 hover:text-navy transition">
                            <Globe className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <Badge variant={client.status as any}>
                        {client.status}
                      </Badge>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-600">{client.industry || "—"}</td>
                    <td className="py-4 px-4 text-right">
                      <Link href={`/admin/clients/${client.id}`}>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}