"use client"

import { useCallback, useEffect, useState } from "react"
import { Sidebar } from "@/components/admin/sidebar"
import { useAdmin } from "@/hooks/use-admin"
import { SidebarProvider, useSidebar } from "@/components/admin/sidebar-provider"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebar()
  const { isAdmin } = useAdmin()
  const [supabase] = useState(() => createClient())
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchUnreadCount = useCallback(async () => {
    if (!isAdmin) return
    const { count, error } = await supabase
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .eq("is_read", false)
    if (!error) setUnreadCount(count || 0)
  }, [isAdmin, supabase])

  useEffect(() => {
    fetchUnreadCount()
    const channel = supabase
      .channel("admin-unread-inquiries")
      .on("postgres_changes", { event: "*", schema: "public", table: "inquiries" }, fetchUnreadCount)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchUnreadCount, supabase])

  if (!isAdmin) return null

  return (
    <div className="min-h-screen bg-gray-50 flex overflow-x-hidden">
      <Sidebar />
      <main className={cn("flex-1 transition-all duration-300 min-w-0 w-full", isCollapsed ? "ml-[80px]" : "ml-[280px]")}>
        <header className="h-[72px] bg-white border-b border-black/5 px-4 lg:px-8 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-3 lg:gap-4">
            <h2 className="text-[11px] lg:text-[13px] font-bold text-gray-400 uppercase tracking-[0.15em] truncate">Management Console</h2>
          </div>

          <div className="flex items-center gap-2 lg:gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-[13px] lg:text-[14px] font-bold text-navy">Admin User</p>
              <p className="text-[11px] lg:text-[12px] text-teal font-semibold">Active Session</p>
            </div>
            <div className="relative w-8 h-8 lg:w-10 lg:h-10 rounded-xl bg-navy text-white flex items-center justify-center text-sm lg:text-base font-bold shadow-lg shadow-navy/10 border border-white/10 shrink-0">
              A
              {unreadCount > 0 && (
                <span className="absolute -right-2 -top-2 min-w-5 h-5 px-1 rounded-full bg-coral text-white text-[9px] font-bold grid place-items-center border-2 border-white leading-none">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </div>
          </div>
        </header>
        <div className="p-4 lg:p-8 max-w-[1400px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}

export function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </SidebarProvider>
  )
}
