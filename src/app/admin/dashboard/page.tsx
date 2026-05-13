import { createServiceClient } from "@/lib/supabase/service"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, FolderKanban, DollarSign, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

async function getStats() {
  const supabase = createServiceClient()

  const [
    { count: totalClients },
    { count: totalProjects },
    { count: activeProjects },
    { data: revenueData },
    { data: recentClients },
  ] = await Promise.all([
    supabase.from("clients").select("*", { count: "exact", head: true }),
    supabase.from("projects").select("*", { count: "exact", head: true }),
    supabase.from("projects").select("*", { count: "exact", head: true }).eq("status", "in_progress"),
    supabase.from("projects").select("budget"),
    supabase.from("clients").select("*, profiles(full_name, email)").order("created_at", { ascending: false }).limit(5),
  ])

  const totalRevenue = revenueData?.reduce((acc, p) => acc + (Number(p.budget) || 0), 0) || 0

  return {
    totalClients: totalClients || 0,
    totalProjects: totalProjects || 0,
    activeProjects: activeProjects || 0,
    totalRevenue,
    recentClients: recentClients || [],
  }
}

export default async function AdminDashboardPage() {
  const stats = await getStats()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-gray-600 mt-1">Overview of your agency performance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="rounded-[24px]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Clients</CardTitle>
            <Users className="w-4 h-4 text-teal" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalClients}</div>
            <p className="text-xs text-gray-500 mt-1">Acquired clients</p>
          </CardContent>
        </Card>

        <Card className="rounded-[24px]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Projects</CardTitle>
            <FolderKanban className="w-4 h-4 text-coral" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalProjects}</div>
            <p className="text-xs text-gray-500 mt-1">All time</p>
          </CardContent>
        </Card>

        <Card className="rounded-[24px]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Active Projects</CardTitle>
            <TrendingUp className="w-4 h-4 text-teal" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.activeProjects}</div>
            <p className="text-xs text-gray-500 mt-1">Currently in progress</p>
          </CardContent>
        </Card>

        <Card className="rounded-[24px]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Revenue</CardTitle>
            <DollarSign className="w-4 h-4 text-coral" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold truncate">K{stats.totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-gray-500 mt-1">Total earnings</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-[32px]">
          <CardHeader>
            <CardTitle>Recent Clients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.recentClients.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No clients found.</p>
              ) : (
                stats.recentClients.map((client: any) => (
                  <div key={client.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-navy/10 grid place-items-center text-xs font-bold text-navy">
                        {client.profiles?.full_name?.charAt(0) || client.profiles?.email?.charAt(0) || "C"}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{client.profiles?.full_name || client.profiles?.email || "Unknown"}</p>
                        <p className="text-xs text-gray-500">{client.company_name || "No company"}</p>
                      </div>
                    </div>
                    <span className={cn(
                      "px-2 py-1 rounded-full text-xs font-medium",
                      client.status === "active" && "bg-teal/10 text-teal",
                      client.status === "inactive" && "bg-gray-100 text-gray-600",
                      client.status === "pending" && "bg-coral/10 text-coral",
                    )}>
                      {client.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[32px]">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <a href="/admin/clients" className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-teal hover:bg-teal/5 transition group">
              <div className="w-10 h-10 rounded-lg bg-teal/10 grid place-items-center group-hover:bg-teal/20 transition">
                <Users className="w-5 h-5 text-teal" />
              </div>
              <div>
                <p className="text-sm font-medium">Manage Clients</p>
                <p className="text-xs text-gray-500">View and update client records</p>
              </div>
            </a>
            <a href="/admin/projects" className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-coral hover:bg-coral/5 transition group">
              <div className="w-10 h-10 rounded-lg bg-coral/10 grid place-items-center group-hover:bg-coral/20 transition">
                <FolderKanban className="w-5 h-5 text-coral" />
              </div>
              <div>
                <p className="text-sm font-medium">Manage Projects</p>
                <p className="text-xs text-gray-500">Track and edit current projects</p>
              </div>
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
