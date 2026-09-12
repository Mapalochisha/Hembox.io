"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/components/providers/auth-provider"
import { cn } from "@/lib/utils"
import {
  Archive,
  CheckCircle2,
  Clock3,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  Send,
  UserRound,
} from "lucide-react"

type InquiryType = "mockup" | "quote" | "pricing" | "contact"
type InquiryStatus = "new" | "contacted" | "in_progress" | "completed" | "archived"
type SenderRole = "customer" | "admin"

type Inquiry = {
  id: string
  type: InquiryType
  contact: string | null
  email: string | null
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

type InquiryMessage = {
  id: string
  inquiry_id: string
  sender_role: SenderRole
  sender_id: string | null
  body: string
  created_at: string
}

const statusOptions: InquiryStatus[] = ["new", "contacted", "in_progress", "completed", "archived"]
const typeLabels: Record<InquiryType, string> = {
  mockup: "Free Mockup",
  quote: "Custom Quote",
  pricing: "Pricing",
  contact: "Contact",
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(value))
}

function statusVariant(status: InquiryStatus) {
  if (status === "new") return "pending" as const
  if (status === "completed") return "active" as const
  if (status === "archived") return "inactive" as const
  return "secondary" as const
}

function isEmail(value: string | null) {
  return !!value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function getContext(message: string | null) {
  if (!message) return { plan: null, service: null, body: "" }
  const plan = message.match(/^Selected plan:\s*(.+)$/m)?.[1] || null
  const service = message.match(/^Selected service:\s*(.+)$/m)?.[1] || null
  const body = message.replace(/^Selected (?:plan|service):.*\n?/gm, "").replace(/^Message:\s*\n?/m, "").trim()
  return { plan, service, body }
}

export default function MessagesPage() {
  const { user } = useAuth()
  const [supabase] = useState(() => createClient())
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [messages, setMessages] = useState<InquiryMessage[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<"all" | InquiryStatus>("all")
  const [search, setSearch] = useState("")
  const [draft, setDraft] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingThread, setIsLoadingThread] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isUpdating, setIsUpdating] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchInquiries = useCallback(async () => {
    setIsLoading(true)
    const { data, error: queryError } = await supabase
      .from("inquiries")
      .select("*")
      .order("updated_at", { ascending: false })

    if (queryError) {
      console.error("Failed to load inquiries:", queryError)
      setError("Unable to load messages. Check the database migration and try again.")
    } else {
      setError(null)
      setInquiries((data || []) as Inquiry[])
    }
    setIsLoading(false)
  }, [supabase])

  const fetchThread = useCallback(async (inquiryId: string) => {
    setIsLoadingThread(true)
    const { data, error: queryError } = await supabase
      .from("inquiry_messages")
      .select("*")
      .eq("inquiry_id", inquiryId)
      .order("created_at", { ascending: true })

    if (queryError) {
      console.error("Failed to load conversation:", queryError)
      setError("Unable to load this conversation.")
      setMessages([])
    } else {
      setError(null)
      setMessages((data || []) as InquiryMessage[])
    }
    setIsLoadingThread(false)
  }, [supabase])

  useEffect(() => {
    fetchInquiries()
    const inquiryChannel = supabase
      .channel("admin-inquiries")
      .on("postgres_changes", { event: "*", schema: "public", table: "inquiries" }, () => fetchInquiries())
      .subscribe()
    const messageChannel = supabase
      .channel("admin-inquiry-messages")
      .on("postgres_changes", { event: "*", schema: "public", table: "inquiry_messages" }, (payload) => {
        const row = payload.new as Partial<InquiryMessage>
        if (selectedId && row.inquiry_id === selectedId) fetchThread(selectedId)
        if (payload.eventType === "INSERT" && row.sender_role === "customer") fetchInquiries()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(inquiryChannel)
      supabase.removeChannel(messageChannel)
    }
  }, [fetchInquiries, fetchThread, selectedId, supabase])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return inquiries.filter((item) => {
      const matchesFilter = filter === "all" || item.status === filter
      if (!matchesFilter) return false
      if (!term) return true
      return [item.name, item.contact, item.email, item.message, item.source]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    })
  }, [filter, inquiries, search])

  const selected = inquiries.find((item) => item.id === selectedId) || filtered[0] || null
  const unreadCount = inquiries.filter((item) => !item.is_read).length
  const selectedContact = selected?.contact || selected?.email || selected?.phone || ""
  const selectedIsEmail = isEmail(selectedContact)
  const whatsappUrl = selectedContact && !selectedIsEmail
    ? `https://wa.me/${selectedContact.replace(/\D/g, "")}`
    : null
  const context = getContext(selected?.message || null)

  useEffect(() => {
    if (!selected) return
    if (selected.id !== selectedId) setSelectedId(selected.id)
  }, [selected, selectedId])

  useEffect(() => {
    if (!selectedId) {
      setMessages([])
      return
    }
    fetchThread(selectedId)
  }, [fetchThread, selectedId])

  const updateInquiry = async (id: string, updates: Partial<Inquiry>) => {
    setIsUpdating(id)
    const { data, error: updateError } = await supabase
      .from("inquiries")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single()

    if (updateError) {
      console.error("Failed to update inquiry:", updateError)
      setError("That update could not be saved.")
    } else if (data) {
      setInquiries((current) => current.map((item) => item.id === id ? data as Inquiry : item))
    }
    setIsUpdating(null)
  }

  const selectConversation = async (item: Inquiry) => {
    setSelectedId(item.id)
    if (!item.is_read) {
      await updateInquiry(item.id, { is_read: true, read_at: new Date().toISOString() })
    }
  }

  const sendReply = async (event: FormEvent) => {
    event.preventDefault()
    const body = draft.trim()
    if (!body || !selected || !user?.id) return

    setIsSending(true)
    setError(null)
    const { data, error: sendError } = await supabase
      .from("inquiry_messages")
      .insert({
        inquiry_id: selected.id,
        sender_role: "admin",
        sender_id: user.id,
        body,
      })
      .select("*")
      .single()

    if (sendError) {
      console.error("Failed to send reply:", sendError)
      setError("Your reply could not be sent. Make sure the messaging migration has been applied.")
    } else if (data) {
      setMessages((current) => [...current, data as InquiryMessage])
      setDraft("")
      await updateInquiry(selected.id, { status: selected.status === "new" ? "contacted" : selected.status, is_read: true, read_at: selected.read_at || new Date().toISOString() })
    }
    setIsSending(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
            {unreadCount > 0 && <span className="min-w-7 h-7 px-2 rounded-full bg-coral text-white text-xs font-bold grid place-items-center">{unreadCount}</span>}
          </div>
          <p className="text-gray-600 mt-1">One place for website inquiries and ongoing client conversations.</p>
        </div>
        <Button variant="outline" onClick={fetchInquiries} disabled={isLoading} className="gap-2 self-start xl:self-auto">
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />Refresh
        </Button>
      </div>

      {error && <div className="rounded-2xl border border-coral/20 bg-coral/5 px-4 py-3 text-sm text-coral">{error}</div>}

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search messages, names or contact details..."
            className="w-full h-11 rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {["all", ...statusOptions].map((value) => (
            <button
              key={value}
              onClick={() => setFilter(value as typeof filter)}
              className={cn(
                "px-3.5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap border transition capitalize",
                filter === value
                  ? "bg-navy text-white border-navy"
                  : "bg-white text-gray-600 border-gray-200 hover:border-teal hover:text-navy"
              )}
            >
              {value === "all" ? `All (${inquiries.length})` : value.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {isLoading && inquiries.length === 0 ? (
        <Card className="rounded-[24px]"><CardContent className="py-20 text-center"><Loader2 className="w-8 h-8 text-teal animate-spin mx-auto" /></CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card className="rounded-[24px]"><CardContent className="py-20 text-center"><MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" /><h3 className="text-lg font-medium text-gray-900">No conversations found</h3><p className="text-gray-500 mt-1">New website inquiries will appear here automatically.</p></CardContent></Card>
      ) : (
        <div className="grid lg:grid-cols-[360px_minmax(0,1fr)] gap-4 min-h-[680px]">
          <Card className="rounded-[24px] overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Inbox</span>
              <span className="text-xs text-gray-400">{filtered.length} conversation{filtered.length === 1 ? "" : "s"}</span>
            </div>
            <div className="divide-y divide-gray-100 max-h-[720px] overflow-y-auto">
              {filtered.map((item) => {
                const itemContact = item.contact || item.email || item.phone || "No contact provided"
                const itemContext = getContext(item.message)
                return (
                  <button
                    key={item.id}
                    onClick={() => selectConversation(item)}
                    className={cn(
                      "w-full text-left p-4 hover:bg-gray-50 transition relative",
                      selected?.id === item.id && "bg-teal/5"
                    )}
                  >
                    {!item.is_read && <span className="absolute left-0 top-0 bottom-0 w-1 bg-coral" />}
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-navy/5 text-navy flex items-center justify-center shrink-0">
                        <UserRound className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn("text-sm truncate", !item.is_read ? "font-bold text-navy" : "font-semibold text-gray-800")}>
                            {item.name || itemContact}
                          </p>
                          <span className="text-[10px] text-gray-400 whitespace-nowrap">{formatTime(item.updated_at || item.created_at)}</span>
                        </div>
                        <p className="text-xs text-gray-500 truncate mt-1">{itemContext.body || item.message || "No message"}</p>
                        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                          <Badge variant={statusVariant(item.status)}>{typeLabels[item.type]}</Badge>
                          {itemContext.plan && <span className="text-[10px] font-semibold text-teal truncate max-w-[150px]">{itemContext.plan}</span>}
                          {!item.is_read && <span className="text-[10px] font-bold text-coral uppercase">New</span>}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </Card>

          <Card className="rounded-[24px] overflow-hidden flex flex-col min-h-[680px]">
            {selected ? <>
              <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4 bg-white">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Badge variant={statusVariant(selected.status)}>{typeLabels[selected.type]}</Badge>
                    {context.plan && <span className="text-xs font-semibold text-teal">{context.plan}</span>}
                    {context.service && <span className="text-xs font-semibold text-gray-500">{context.service}</span>}
                  </div>
                  <h2 className="text-xl font-bold text-navy truncate">{selected.name || "Website inquiry"}</h2>
                  <p className="text-sm text-gray-500 mt-1">Started {formatDate(selected.created_at)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={selected.status}
                    disabled={isUpdating === selected.id}
                    onChange={(event) => updateInquiry(selected.id, { status: event.target.value as InquiryStatus })}
                    className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium capitalize outline-none focus:ring-2 focus:ring-teal/20"
                  >
                    {statusOptions.map((status) => <option key={status} value={status}>{status.replace("_", " ")}</option>)}
                  </select>
                  {selected.status !== "archived" && (
                    <Button
                      variant="outline"
                      title="Archive conversation"
                      onClick={() => updateInquiry(selected.id, { status: "archived" })}
                      disabled={isUpdating === selected.id}
                      className="h-10 w-10 p-0"
                    >
                      <Archive className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid xl:grid-cols-[minmax(0,1fr)_250px] flex-1 min-h-0">
                <div className="flex flex-col min-h-[580px] border-r border-gray-100">
                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-gray-50/60">
                    {context.body && messages.length === 0 && (
                      <div className="flex justify-start">
                        <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-white border border-gray-100 px-4 py-3 shadow-sm">
                          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{context.body}</p>
                          <p className="text-[10px] text-gray-400 mt-2">{formatTime(selected.created_at)}</p>
                        </div>
                      </div>
                    )}
                    {isLoadingThread ? (
                      <div className="py-12 text-center"><Loader2 className="w-6 h-6 text-teal animate-spin mx-auto" /></div>
                    ) : messages.map((message) => (
                      <div key={message.id} className={cn("flex", message.sender_role === "admin" ? "justify-end" : "justify-start")}>
                        <div className={cn(
                          "max-w-[85%] rounded-2xl px-4 py-3 shadow-sm",
                          message.sender_role === "admin"
                            ? "bg-navy text-white rounded-tr-md"
                            : "bg-white border border-gray-100 text-gray-700 rounded-tl-md"
                        )}>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.body}</p>
                          <div className={cn("flex items-center gap-1.5 mt-2 text-[10px]", message.sender_role === "admin" ? "text-white/60 justify-end" : "text-gray-400")}>
                            <span>{message.sender_role === "admin" ? "You" : selected.name || "Client"}</span>
                            <span>•</span>
                            <span>{formatTime(message.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={sendReply} className="p-4 border-t border-gray-100 bg-white">
                    <div className="flex items-end gap-2">
                      <textarea
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault()
                            event.currentTarget.form?.requestSubmit()
                          }
                        }}
                        rows={2}
                        maxLength={5000}
                        placeholder="Write a reply..."
                        className="min-h-[52px] max-h-36 flex-1 resize-y rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-teal/20 focus:border-teal"
                      />
                      <Button type="submit" disabled={!draft.trim() || isSending} className="h-11 px-4 gap-2 shrink-0">
                        {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        <span className="hidden sm:inline">Send</span>
                      </Button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2">Enter to send • Shift + Enter for a new line</p>
                  </form>
                </div>

                <aside className="p-4 sm:p-5 space-y-5 bg-white">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">Client</p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-teal/10 text-teal flex items-center justify-center"><UserRound className="w-5 h-5" /></div>
                      <div className="min-w-0"><p className="text-sm font-bold text-navy truncate">{selected.name || "Unknown client"}</p><p className="text-xs text-gray-500 truncate">{selectedContact || "No contact"}</p></div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {selectedContact && <a href={selectedIsEmail ? `mailto:${selectedContact}` : whatsappUrl || `tel:${selectedContact}`} target={whatsappUrl ? "_blank" : undefined} rel={whatsappUrl ? "noopener noreferrer" : undefined} className="flex items-center gap-2 rounded-xl border border-gray-100 px-3 py-2.5 text-xs font-semibold text-navy hover:border-teal transition"><{selectedIsEmail ? "Mail" : "Phone"} className="w-4 h-4 text-teal" />{selectedIsEmail ? "Email client" : "Contact client"}</a>}
                  </div>

                  <div className="pt-4 border-t border-gray-100 space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Context</p>
                    {context.plan && <div><p className="text-[10px] text-gray-400">Selected plan</p><p className="text-xs font-semibold text-navy mt-0.5">{context.plan}</p></div>}
                    {context.service && <div><p className="text-[10px] text-gray-400">Selected service</p><p className="text-xs font-semibold text-navy mt-0.5">{context.service}</p></div>}
                    <div><p className="text-[10px] text-gray-400">Source</p><p className="text-xs font-semibold text-navy mt-0.5">{selected.source || "Website"}</p></div>
                  </div>

                  <div className="pt-4 border-t border-gray-100 space-y-2">
                    <Button variant="outline" className="w-full justify-start gap-2" onClick={() => updateInquiry(selected.id, { is_read: true, read_at: selected.read_at || new Date().toISOString() })} disabled={selected.is_read || isUpdating === selected.id}>
                      <CheckCircle2 className="w-4 h-4" />Mark as read
                    </Button>
                    <div className="flex items-center gap-2 text-[11px] text-gray-400 px-1"><Clock3 className="w-3.5 h-3.5" />Updated {formatTime(selected.updated_at)}</div>
                  </div>
                </aside>
              </div>
            </> : (
              <div className="flex-1 grid place-items-center text-center p-10">
                <div><MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" /><h3 className="text-lg font-medium text-gray-900">Select a conversation</h3><p className="text-sm text-gray-500 mt-1">Choose a message from the inbox to view the thread.</p></div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
