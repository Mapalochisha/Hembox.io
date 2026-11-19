"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { BRAND_NAME } from "@/lib/brand"
import { useEffect, useRef, useState } from "react"
import { useAuth } from "@/components/providers/auth-provider"
import { cn } from "@/lib/utils"
import {
  Bell, BriefcaseBusiness, ChevronDown, CreditCard, Files, FolderKanban,
  Globe2, LayoutDashboard, Menu, MessageSquare, Settings2, PlusCircle,
  X, LogOut, ArrowUpRight
} from "lucide-react"

const navigation = [
  { label: "WORKSPACE", items: [
    { label: "Overview", href: "/portal", icon: LayoutDashboard },
    { label: "My projects", href: "/portal/projects", icon: FolderKanban },
    { label: "My services", href: "/portal/services", icon: BriefcaseBusiness },
  ]},
  { label: "MANAGE", items: [
    { label: "Domains", href: "/portal/domains", icon: Globe2 },
    { label: "Files", href: "/portal/files", icon: Files },
    { label: "Bills & payments", href: "/portal/bills", icon: CreditCard },
    { label: "Messages & support", href: "/portal/messages", icon: MessageSquare },
  ]},
]

export function PortalShell({ children, title, eyebrow = "CLIENT WORKSPACE" }: {
  children: React.ReactNode
  title: string
  eyebrow?: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, isLoading, signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null)
  const wasMobileOpen = useRef(false)
  const [unreadNotifications, setUnreadNotifications] = useState(0)

  const [activityOpen, setActivityOpen] = useState(false)
  const [activityItems, setActivityItems] = useState<Array<{id:string;category:string;title:string;body:string;href:string|null;read_at:string|null;created_at:string}>>([])
  const [activityLoading, setActivityLoading] = useState(false)
  const [activityError, setActivityError] = useState("")
  const activityPanelRef = useRef<HTMLDivElement>(null)

  async function loadActivity() {
    setActivityLoading(true)
    setActivityError("")
    try {
      const response = await fetch("/api/portal/notifications", { cache: "no-store" })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Activity is temporarily unavailable.")
      setActivityItems(result.notifications ?? [])
      setUnreadNotifications(typeof result.unreadCount === "number" ? result.unreadCount : 0)
    } catch (error) {
      setActivityError(error instanceof Error ? error.message : "Activity is temporarily unavailable.")
    } finally {
      setActivityLoading(false)
    }
  }

  async function toggleActivity() {
    const next = !activityOpen
    setActivityOpen(next)
    if (next) await loadActivity()
  }

  function openActivityItem(item: {id:string;category:string;href:string|null;read_at:string|null}) {
    if (!item.read_at) {
      void fetch("/api/portal/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: item.id }),
      }).then((response) => {
        if (response.ok) {
          setActivityItems((rows) => rows.map((row) => row.id === item.id ? { ...row, read_at: new Date().toISOString() } : row))
          setUnreadNotifications((count) => Math.max(0, count - 1))
        }
      }).catch(() => undefined)
    }
    const destination = item.href?.startsWith("/portal/") ? item.href : item.category === "message" ? "/portal/messages" : "/portal/notifications"
    setActivityOpen(false)
    router.push(destination)
  }

  useEffect(() => {
    if (!activityOpen) return
    const closeOnOutside = (event: MouseEvent) => {
      if (activityPanelRef.current && !activityPanelRef.current.contains(event.target as Node)) setActivityOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActivityOpen(false)
    }
    document.addEventListener("mousedown", closeOnOutside)
    window.addEventListener("keydown", closeOnEscape)
    return () => {
      document.removeEventListener("mousedown", closeOnOutside)
      window.removeEventListener("keydown", closeOnEscape)
    }
  }, [activityOpen])


  useEffect(() => {
    if (mobileOpen) {
      wasMobileOpen.current = true
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          event.preventDefault()
          setMobileOpen(false)
          mobileMenuTriggerRef.current?.focus()
        }
      }
      window.addEventListener("keydown", handleKeyDown)
      return () => window.removeEventListener("keydown", handleKeyDown)
    }
    if (wasMobileOpen.current) {
      mobileMenuTriggerRef.current?.focus()
      wasMobileOpen.current = false
    }
  }, [mobileOpen])

  useEffect(() => {
    if (!user) { setUnreadNotifications(0); return }
    let active = true
    void fetch("/api/portal/notifications", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() : null)
      .then((result) => { if (active && result && typeof result.unreadCount === "number") { setUnreadNotifications(result.unreadCount); setActivityItems(result.notifications ?? []) } })
      .catch(() => { if (active) setUnreadNotifications(0) })
    return () => { active = false }
  }, [user?.id])

  if (isLoading) {
    return <div className="grid min-h-screen place-items-center bg-[#f6f8fb]" role="status" aria-label="Loading your workspace">
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-teal" />
        <span className="text-sm font-medium text-slate-600">Preparing your workspace…</span>
      </div>
    </div>
  }

  if (!user) {
    if (typeof window !== "undefined") window.location.replace("/login?next=" + encodeURIComponent(pathname || "/portal"))
    return <div className="min-h-screen bg-[#f6f8fb]" />
  }

  const initials = (user.full_name || user.email || "H").split(/[\s@]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase()

  const navContents = (
    <>
      <div className="px-5 pb-6 pt-5">
        <Link href="/" className="inline-flex items-center gap-3" onClick={() => setMobileOpen(false)} aria-label={`${BRAND_NAME} home`}>
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal text-[#102033] shadow-lg shadow-teal/10">
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M3 3h8v8H3zM13 3h8v5h-8zM3 13h5v8H3zM10 13h11v8H10z" fill="currentColor"/>
            </svg>
          </span>
          <span className="text-[18px] font-extrabold tracking-tight text-white">{BRAND_NAME}</span>
        </Link>
        <div className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-xs font-bold text-white">{initials}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{user.full_name || "Your workspace"}</p>
              <p className="truncate text-xs text-slate-400">{user.email}</p>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-500" />
          </div>
        </div>
      </div>

      <nav aria-label="Client workspace navigation" className="flex-1 space-y-7 overflow-y-auto px-3 pb-4">
        {navigation.map((group) => (
          <div key={group.label}>
            <p className="mb-2 px-3 text-[10px] font-bold tracking-[0.18em] text-slate-500">{group.label}</p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = item.href === "/portal" ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/")
                const Icon = item.icon
                return <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} aria-current={active ? "page" : undefined}
                  className={cn("group flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal",
                    active ? "bg-teal text-[#102033] shadow-sm shadow-teal/10" : "text-slate-400 hover:bg-white/[0.06] hover:text-white")}>
                  <Icon className={cn("h-[17px] w-[17px] shrink-0", active ? "text-[#102033]" : "text-slate-500 group-hover:text-teal")} strokeWidth={1.8}/>
                  <span className="flex-1">{item.label}</span>
                  {active && <span className="h-1.5 w-1.5 rounded-full bg-[#102033]" />}
                </Link>
              })}
            </div>
          </div>
        ))}
        <div>
          <p className="mb-2 px-3 text-[10px] font-bold tracking-[0.18em] text-slate-500">ACCOUNT</p>
          <Link href="/portal/settings" onClick={() => setMobileOpen(false)} aria-current={pathname.startsWith("/portal/settings") ? "page" : undefined}
            className={cn("flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition-colors",
              pathname.startsWith("/portal/settings") ? "bg-teal text-[#102033]" : "text-slate-400 hover:bg-white/[0.06] hover:text-white")}>
            <Settings2 className="h-[17px] w-[17px]" strokeWidth={1.8}/> Account settings
          </Link>
        </div>
      </nav>

      <div className="border-t border-white/[0.08] p-3">
        <Link href="/portal/services/catalogue" onClick={() => setMobileOpen(false)} className="group flex items-center gap-3 rounded-xl border border-white/[0.09] bg-white/[0.04] p-3 transition hover:border-teal/40 hover:bg-white/[0.07]">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal/10 text-teal"><PlusCircle className="h-4 w-4"/></span>
          <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-white">Need something new?</span><span className="mt-0.5 block text-[11px] text-slate-400">Explore our services</span></span>
          <ArrowUpRight className="h-4 w-4 text-slate-500 transition group-hover:text-teal"/>
        </Link>
        <button onClick={() => void signOut()} className="mt-2 flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-xs font-medium text-slate-400 transition hover:bg-rose-400/10 hover:text-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">
          <LogOut className="h-4 w-4"/> Sign out
        </button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-[#172338]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[258px] flex-col border-r border-white/[0.06] bg-[#111c2e] lg:flex">{navContents}</aside>
      {mobileOpen && <button aria-label="Close navigation overlay" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" />}
      {mobileOpen && <aside className="fixed inset-y-0 left-0 z-50 flex w-[min(86vw,300px)] flex-col border-r border-white/[0.06] bg-[#111c2e] shadow-2xl lg:hidden">
        <div className="absolute right-3 top-4 z-10"><button aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg text-slate-300 hover:bg-white/10"><X className="h-5 w-5"/></button></div>
        {navContents}
      </aside>}

      <div className="min-h-screen lg:pl-[258px]">
        <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl sm:px-6 lg:px-9">
          <div className="flex min-w-0 items-center gap-3">
            <button ref={mobileMenuTriggerRef} aria-label="Open workspace navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 lg:hidden"><Menu className="h-4 w-4"/></button>
            <div className="min-w-0">
              <p className="hidden text-[9px] font-bold tracking-[0.17em] text-slate-400 sm:block">{eyebrow}</p>
              <h1 className="truncate text-[15px] font-bold tracking-tight text-[#172338] sm:mt-0.5 sm:text-base">{title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative" ref={activityPanelRef}>
              <button type="button" onClick={() => void toggleActivity()} aria-label={unreadNotifications ? "Messages and notifications, " + unreadNotifications + " unread" : "Messages and notifications"} aria-expanded={activityOpen} aria-haspopup="dialog" className={"relative grid h-9 w-9 place-items-center rounded-xl border text-slate-600 transition hover:bg-slate-50 " + (activityOpen ? "border-teal bg-teal/5" : "border-slate-200 hover:border-slate-300")}>
                <Bell className="h-4 w-4"/>
                {unreadNotifications > 0 && <span className="absolute -right-1 -top-1 grid min-h-[17px] min-w-[17px] place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">{unreadNotifications > 9 ? "9+" : unreadNotifications}</span>}
              </button>
              {activityOpen && (
                <div role="dialog" aria-label="Messages and notifications" className="absolute right-0 top-12 z-50 w-[min(92vw,390px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <div><p className="text-sm font-bold text-slate-900">Activity</p><p className="mt-0.5 text-[10px] text-slate-500">{unreadNotifications ? unreadNotifications + " unread update(s)" : "Your latest messages and updates"}</p></div>
                    <button type="button" onClick={() => void loadActivity()} aria-label="Refresh activity" className="rounded-lg p-2 text-xs font-semibold text-slate-500 hover:bg-slate-100">Refresh</button>
                  </div>
                  {activityError && <p role="alert" className="m-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{activityError}</p>}
                  {activityLoading ? <div className="space-y-2 p-4"><div className="h-14 animate-pulse rounded-xl bg-slate-100"/><div className="h-14 animate-pulse rounded-xl bg-slate-100"/></div> : (
                    <div className="max-h-[min(65vh,440px)] overflow-y-auto">
                      {activityItems.some((item) => item.category === "message") && (
                        <section className="border-b border-slate-100 p-3">
                          <p className="px-1 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Messages</p>
                          {activityItems.filter((item) => item.category === "message").slice(0, 3).map((item) => (
                            <button key={item.id} type="button" onClick={() => openActivityItem(item)} className="flex w-full items-start gap-3 rounded-xl p-2.5 text-left hover:bg-slate-50">
                              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-teal/10 text-teal"><MessageSquare className="h-4 w-4"/></span>
                              <span className="min-w-0 flex-1"><span className="flex items-center gap-2 text-xs font-bold text-slate-800">{item.title}{!item.read_at && <span className="h-1.5 w-1.5 rounded-full bg-rose-500"/>}</span><span className="mt-1 block line-clamp-2 text-[11px] leading-5 text-slate-500">{item.body}</span><span className="mt-1 block text-[9px] text-slate-400">{new Date(item.created_at).toLocaleString()}</span></span>
                            </button>
                          ))}
                        </section>
                      )}
                      {activityItems.some((item) => item.category !== "message") && (
                        <section className="p-3">
                          <p className="px-1 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Notifications</p>
                          {activityItems.filter((item) => item.category !== "message").slice(0, 4).map((item) => (
                            <button key={item.id} type="button" onClick={() => openActivityItem(item)} className="flex w-full items-start gap-3 rounded-xl p-2.5 text-left hover:bg-slate-50">
                              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600"><Bell className="h-4 w-4"/></span>
                              <span className="min-w-0 flex-1"><span className="flex items-center gap-2 text-xs font-bold text-slate-800">{item.title}{!item.read_at && <span className="h-1.5 w-1.5 rounded-full bg-rose-500"/>}</span><span className="mt-1 block line-clamp-2 text-[11px] leading-5 text-slate-500">{item.body}</span><span className="mt-1 block text-[9px] text-slate-400">{new Date(item.created_at).toLocaleString()}</span></span>
                            </button>
                          ))}
                        </section>
                      )}
                      {!activityItems.length && !activityError && <p className="px-5 py-8 text-center text-xs text-slate-500">No messages or notifications yet.</p>}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 border-t border-slate-100 bg-slate-50 p-3">
                    <Link href="/portal/messages" onClick={() => setActivityOpen(false)} className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100">Open inbox</Link>
                    <Link href="/portal/notifications" onClick={() => setActivityOpen(false)} className="inline-flex h-9 items-center justify-center rounded-lg bg-[#142239] text-xs font-bold text-white hover:bg-[#203653]">All notifications</Link>
                  </div>
                </div>
              )}
            </div>
            <div className="hidden h-8 w-px bg-slate-200 sm:block"/>
            <div className="hidden text-right sm:block"><p className="max-w-40 truncate text-xs font-semibold text-slate-800">{user.full_name || "Client"}</p><p className="text-[10px] text-slate-500">Client account</p></div>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#e7f8f5] text-xs font-bold text-[#147c73] ring-1 ring-inset ring-teal/15">{initials}</div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-9 lg:py-9">{children}</main>
        <footer className="px-4 pb-6 text-center text-[11px] text-slate-400 sm:px-6 lg:px-9">{BRAND_NAME} Workspace <span className="mx-1.5">·</span> Creative, digital &amp; technical services</footer>
      </div>
    </div>
  )
}
