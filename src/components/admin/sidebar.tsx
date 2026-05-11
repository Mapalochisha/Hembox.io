"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  BarChart3,
  Image,
  MessageSquare,
  Settings,
  Briefcase,
  Star,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Home
} from "lucide-react"
import { useAuth } from "@/components/providers/auth-provider"

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/admin/dashboard" },
  { icon: BarChart3, label: "Analytics", href: "/admin/analytics" },
  { icon: Users, label: "Clients", href: "/admin/clients" },
  { icon: FolderKanban, label: "Projects", href: "/admin/projects" },
  { icon: Briefcase, label: "Services", href: "/admin/services" },
  { icon: Star, label: "Portfolio", href: "/admin/portfolio" },
  { icon: Image, label: "Media", href: "/admin/media" },
  { icon: MessageSquare, label: "Messages", href: "/admin/messages" },
]

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const pathname = usePathname()
  const { signOut, user } = useAuth()

  return (
    <aside 
      className={cn(
        "fixed left-0 top-0 h-screen bg-navy transition-all duration-300 z-50 flex flex-col",
        isCollapsed ? "w-[80px]" : "w-[280px]"
      )}
    >
      {/* Logo Area */}
      <div className="h-[72px] flex items-center px-6 border-b border-white/5">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-teal flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M4 4h7v7H4zM13 4h7v4h-7zM4 13h4v7H4zM13 11h7v9h-7z" fill="#0F172A" />
            </svg>
          </div>
          {!isCollapsed && (
            <span className="text-[18px] font-bold text-white tracking-tight">Hembox.io</span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-3 rounded-xl transition-all group",
              pathname === item.href 
                ? "bg-teal text-navy font-bold" 
                : "text-gray-400 hover:text-white hover:bg-white/5"
            )}
          >
            <item.icon className={cn("w-5 h-5 shrink-0", pathname === item.href ? "text-navy" : "group-hover:text-teal")} />
            {!isCollapsed && <span className="text-[15px]">{item.label}</span>}
          </Link>
        ))}
      </nav>

      {/* Footer Area */}
      <div className="p-4 border-t border-white/5 space-y-2">
        <Link
          href="/admin/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-3 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all group",
            pathname === "/admin/settings" && "bg-white/10 text-white"
          )}
        >
          <Settings className="w-5 h-5 shrink-0 group-hover:text-teal" />
          {!isCollapsed && <span className="text-[15px]">Settings</span>}
        </Link>
        
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-gray-400 hover:text-coral hover:bg-coral/5 transition-all group text-left"
        >
          <LogOut className="w-5 h-5 shrink-0 group-hover:text-coral" />
          {!isCollapsed && <span className="text-[15px]">Sign Out</span>}
        </button>

        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full mt-2 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-all"
        >
          {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>
    </aside>
  )
}
