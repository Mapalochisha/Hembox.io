"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Loader2, TrendingUp, DollarSign, Users, CheckCircle2 } from "lucide-react"

interface ChartData {
  month: string
  revenue: number
  projects: number
}

export default function AnalyticsPage() {
  const [isMounted, setIsMounted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<ChartData[]>([])
  const [stats, setStats] = useState({
    totalRevenue: 0,
    activeProjects: 0,
    completedProjects: 0,
    avgBudget: 0
  })

  const supabase = createClient()

  useEffect(() => {
    setIsMounted(true)
    fetchRealData()
  }, [])

  const fetchRealData = async () => {
    try {
      const { data: projects, error } = await supabase
        .from('projects')
        .select('budget, created_at, status')

      if (error) throw error

      if (projects) {
        // Calculate Stats
        const total = projects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0)
        const active = projects.filter(p => p.status === 'in_progress').length
        const completed = projects.filter(p => p.status === 'completed').length
        const avg = projects.length > 0 ? total / projects.length : 0

        setStats({
          totalRevenue: total,
          activeProjects: active,
          completedProjects: completed,
          avgBudget: avg
        })

        // Group by Month for Charts
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        const last6Months = Array.from({ length: 6 }, (_, i) => {
          const d = new Date()
          d.setMonth(d.getMonth() - (5 - i))
          return {
            month: monthNames[d.getMonth()],
            monthIdx: d.getMonth(),
            year: d.getFullYear(),
            revenue: 0,
            projects: 0
          }
        })

        projects.forEach(p => {
          const pDate = new Date(p.created_at)
          const targetMonth = last6Months.find(m => m.monthIdx === pDate.getMonth() && m.year === pDate.getFullYear())
          if (targetMonth) {
            targetMonth.revenue += (Number(p.budget) || 0)
            targetMonth.projects += 1
          }
        })

        setData(last6Months.map(({ month, revenue, projects }) => ({ month, revenue, projects })))
      }
    } catch (error) {
      console.error("Analytics fetch error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isMounted || isLoading) {
    return (
      <div className="h-[600px] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-teal animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-navy">Financial Analytics</h1>
        <p className="text-gray-600 mt-1">Real-time performance tracking based on your project budgets</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="rounded-[24px] border-black/5 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-teal/10 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-teal" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Revenue</p>
                <h3 className="text-2xl font-black text-navy">K{stats.totalRevenue.toLocaleString()}</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[24px] border-black/5 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-coral/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-coral" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Avg Budget</p>
                <h3 className="text-2xl font-black text-navy">K{Math.round(stats.avgBudget).toLocaleString()}</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[24px] border-black/5 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-navy/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-navy" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Active</p>
                <h3 className="text-2xl font-black text-navy">{stats.activeProjects} Projects</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[24px] border-black/5 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-teal/10 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-teal" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Completed</p>
                <h3 className="text-2xl font-black text-navy">{stats.completedProjects} Done</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-[32px] border-black/5 shadow-sm overflow-hidden">
          <CardHeader className="p-8 pb-0">
            <CardTitle className="text-xl font-bold text-navy">Revenue Growth (Last 6 Months)</CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(v) => `K${v}`} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ backgroundColor: "#0F172A", borderRadius: "12px", border: "none", color: "#fff" }}
                  itemStyle={{ color: "#2DD4BF" }}
                  formatter={(value: number) => [`K${value.toLocaleString()}`, "Revenue"]}
                />
                <Bar dataKey="revenue" fill="#2DD4BF" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-[32px] border-black/5 shadow-sm overflow-hidden">
          <CardHeader className="p-8 pb-0">
            <CardTitle className="text-xl font-bold text-navy">New Projects Frequency</CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#0F172A", borderRadius: "12px", border: "none", color: "#fff" }}
                  itemStyle={{ color: "#FF5A5F" }}
                />
                <Line 
                  type="monotone" 
                  dataKey="projects" 
                  stroke="#FF5A5F" 
                  strokeWidth={4} 
                  dot={{ fill: "#FF5A5F", r: 6, strokeWidth: 2, stroke: "#fff" }} 
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
