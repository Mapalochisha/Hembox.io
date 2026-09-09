"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { MessageSquare, RefreshCw, Mail, ExternalLink, CheckCircle2, Clock3, Loader2 } from "lucide-react"

type InquiryType = "mockup" | "quote" | "pricing" | "contact"
type InquiryStatus = "new" | "contacted" | "in_progress" | "completed" | "archived"

type Inquiry = {
  id: string
  type: InquiryType
  email: string
  name: string | null
  phone: string | null
  website: string | null
  message: string | null
  source: string | null
  status: InquiryStatus
  is_read: boolean
  read_at: string | null
  admin_notes: string | null
  created_at: string
  updated_at: string
}

const statusOptions: InquiryStatus[] = ["new", "contacted", "in_progress", "completed", "archived"]
const typeLabels: Record<InquiryType, string> = { mockup: "Free Mockup", quote: "Custom Quote", pricing: "Pricing", contact: "Contact" }

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}

function statusVariant(status: InquiryStatus) {
  if (status === "new") return "pending" as const
  if (status === "completed") return "active" as const
  if (status === "archived") return "inactive" as const
  return "secondary" as const
}

export default function MessagesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<"all" | InquiryStatus>("all")
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState<string | null>(null)
  const supabase = createClient()

  const fetchInquiries = useCallback(async () => {
    setIsLoading(true)
    const { data, error } = await supabase.from("inquiries").select("*").order("created_at", { ascending: false })
    if (error) {
      console.error("Failed to load inquiries:", error)
      setInquiries([])
    } else {
      setInquiries((data || []) as Inquiry[])
    }
    setIsLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchInquiries()
    const channel = supabase.channel("admin-inquiries").on("postgres_changes", { event: "*", schema: "public", table: "inquiries" }, () => fetchInquiries()).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchInquiries, supabase])

  const filtered = useMemo(() => filter === "all" ? inquiries : inquiries.filter((item) => item.status === filter), [filter, inquiries])
  const selected = inquiries.find((item) => item.id === selectedId) || filtered[0] || null

  useEffect(() => {
    if (selected && !selectedId) setSelectedId(selected.id)
  }, [selected, selectedId])

  const updateInquiry = async (id: string, updates: Partial<Inquiry>) => {
    setIsUpdating(id)
    const { data, error } = await supabase.from("inquiries").update(updates).eq("id", id).select("*").single()
    if (!error && data) setInquiries((current) => current.map((item) => item.id === id ? data as Inquiry : item))
    else if (error) console.error("Failed to update inquiry:", error)
    setIsUpdating(null)
  }

  const markRead = async (item: Inquiry) => {
    if (!item.is_read) await updateInquiry(item.id, { is_read: true, read_at: new Date().toISOString() })
  }

  const unreadCount = inquiries.filter((item) => !item.is_read).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
            {unreadCount > 0 && <span className="min-w-7 h-7 px-2 rounded-full bg-coral text-white text-xs font-bold grid place-items-center">{unreadCount}</span>}
          </div>
          <p className="text-gray-600 mt-1">Website leads, mockup requests and custom quote inquiries</p>
        </div>
        <Button variant="outline" onClick={fetchInquiries} disabled={isLoading} className="gap-2"><RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />Refresh</Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {["all", ...statusOptions].map((value) => (
          <button key={value} onClick={() => setFilter(value as typeof filter)} className={cn("px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap border transition", filter === value ? "bg-navy text-white border-navy" : "bg-white text-gray-600 border-gray-200 hover:border-teal hover:text-navy")}>
            {value === "all" ? `All (${inquiries.length})` : value.replace("_", " ")}
          </button>
        ))}
      </div>

      {isLoading && inquiries.length === 0 ? (
        <Card className="rounded-[24px]"><CardContent className="py-16 text-center"><Loader2 className="w-8 h-8 text-teal animate-spin mx-auto" /></CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card className="rounded-[24px]"><CardContent className="py-16 text-center"><MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" /><h3 className="text-lg font-medium text-gray-900">No inquiries yet</h3><p className="text-gray-500 mt-1">New website requests will appear here automatically.</p></CardContent></Card>
      ) : (
        <div className="grid lg:grid-cols-[380px_1fr] gap-5 min-h-[600px]">
          <Card className="rounded-[24px] overflow-hidden">
            <div className="divide-y divide-gray-100 max-h-[700px] overflow-y-auto">
              {filtered.map((item) => (
                <button key={item.id} onClick={() => { setSelectedId(item.id); markRead(item) }} className={cn("w-full text-left p-4 hover:bg-gray-50 transition relative", selected?.id === item.id && "bg-teal/5")}>
                  {!item.is_read && <span className="absolute left-0 top-0 bottom-0 w-1 bg-coral" />}
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className={cn("text-sm truncate", !item.is_read ? "font-bold text-navy" : "font-medium text-gray-800")}>{item.name || item.email}</p><p className="text-xs text-gray-500 truncate mt-1">{item.email}</p></div><span className="text-[10px] text-gray-400 whitespace-nowrap">{formatDate(item.created_at)}</span></div>
                  <div className="flex items-center gap-2 mt-3"><Badge variant={statusVariant(item.status)}>{typeLabels[item.type]}</Badge>{!item.is_read && <span className="text-[10px] font-bold text-coral uppercase">New</span>}</div>
                </button>
              ))}
            </div>
          </Card>

          <Card className="rounded-[24px] overflow-hidden">
            {selected && <>
              <div className="p-5 sm:p-7 border-b border-gray-100 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div><div className="flex items-center gap-2 mb-2"><Badge variant={statusVariant(selected.status)}>{typeLabels[selected.type]}</Badge>{!selected.is_read && <span className="text-xs font-bold text-coral">UNREAD</span>}</div><h2 className="text-xl font-bold text-navy">{selected.name || "New website inquiry"}</h2><p className="text-sm text-gray-500 mt-1">Received {formatDate(selected.created_at)}</p></div>
                <select value={selected.status} disabled={isUpdating === selected.id} onChange={(e) => updateInquiry(selected.id, { status: e.target.value as InquiryStatus })} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium capitalize focus:outline-none focus:ring-2 focus:ring-teal/30">{statusOptions.map((status) => <option key={status} value={status}>{status.replace("_", " ")}</option>)}</select>
              </div>

              <div className="p-5 sm:p-7 space-y-6">
                <div className="grid sm:grid-cols-2 gap-4">
                  <a href={`mailto:${selected.email}`} className="rounded-2xl border border-gray-100 p-4 hover:border-teal transition group"><div className="flex items-center gap-2 text-xs text-gray-500 mb-2"><Mail className="w-4 h-4 text-teal" />Email</div><p className="text-sm font-semibold text-navy break-all group-hover:text-teal">{selected.email}</p></a>
                  {selected.website ? <a href={selected.website.startsWith("http") ? selected.website : `https://${selected.website}`} target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-gray-100 p-4 hover:border-teal transition group"><div className="flex items-center gap-2 text-xs text-gray-500 mb-2"><ExternalLink className="w-4 h-4 text-teal" />Website / Idea</div><p className="text-sm font-semibold text-navy break-all group-hover:text-teal">{selected.website}</p></a> : <div className="rounded-2xl border border-gray-100 p-4"><div className="flex items-center gap-2 text-xs text-gray-500 mb-2"><Clock3 className="w-4 h-4 text-teal" />Source</div><p className="text-sm font-semibold text-navy">{selected.source || "Website"}</p></div>}
                </div>
                {selected.phone && <div><p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Phone</p><p className="text-sm text-gray-700">{selected.phone}</p></div>}
                {selected.message && <div><p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Message</p><div className="rounded-2xl bg-gray-50 border border-gray-100 p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{selected.message}</div></div>}
                <div className="flex flex-wrap gap-3 pt-2">{!selected.is_read && <Button onClick={() => markRead(selected)} disabled={isUpdating === selected.id} className="gap-2"><CheckCircle2 className="w-4 h-4" />Mark as read</Button>}<Button variant="outline" onClick={() => updateInquiry(selected.id, { status: "contacted", is_read: true, read_at: selected.read_at || new Date().toISOString() })} disabled={isUpdating === selected.id}>Mark contacted</Button></div>
              </div>
            </>}
          </Card>
        </div>
      )}
    </div>
  )
}