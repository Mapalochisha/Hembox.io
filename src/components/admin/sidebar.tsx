"use client"

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
  PanelLeftClose,
  PanelLeftOpen
} from "lucide-react"
import { useAuth } from "@/components/providers/auth-provider"
import { useSidebar } from "./sidebar-provider"

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
  const { isCollapsed, toggleSidebar } = useSidebar()
  const pathname = usePathname()
  const { signOut } = useAuth()

  return (
    <aside 
      className={cn(
        "fixed left-0 top-0 h-screen bg-[#0F172A] transition-all duration-300 z-50 flex flex-col border-r border-white/5 shadow-2xl",
        isCollapsed ? "w-0 lg:w-[80px]" : "w-[280px]",
        isCollapsed ? "-translate-x-full lg:translate-x-0" : "translate-x-0"
      )}
    >
      {/* Logo & Toggle Area */}
      <div className="h-[72px] flex items-center justify-between px-4 border-b border-white/5 shrink-0 overflow-hidden">
        <div className={cn(
          "flex items-center gap-3 pl-2 transition-all duration-300",
          isCollapsed ? "opacity-0 invisible w-0" : "opacity-100 visible w-auto"
        )}>
          <div className="w-8 h-8 rounded-lg bg-teal flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M4 4h7v7H4zM13 4h7v4h-7zM4 13h4v7H4zM13 11h7v9h-7z" fill="#0F172A" />
            </svg>
          </div>
          <span className="text-[17px] font-bold text-white tracking-tight whitespace-nowrap">Hembox.io</span>
        </div>
        
        <button 
          onClick={toggleSidebar}
          className={cn(
            "h-9 w-9 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all shrink-0",
            isCollapsed && "mx-auto"
          )}
        >
          {isCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-3 rounded-xl transition-all group overflow-hidden whitespace-nowrap",
              pathname === item.href 
                ? "bg-teal text-[#0F172A] font-bold" 
                : "text-gray-400 hover:text-white hover:bg-white/5"
            )}
          >
            <item.icon className={cn("w-5 h-5 shrink-0", pathname === item.href ? "text-[#0F172A]" : "group-hover:text-teal")} />
            <span className={cn(
              "text-[14.5px] transition-all duration-300",
              isCollapsed ? "opacity-0 -translate-x-4 invisible" : "opacity-100 translate-x-0 visible"
            )}>
              {item.label}
            </span>
          </Link>
        ))}
      </nav>

      {/* Footer Area */}
      <div className="p-3 border-t border-white/5 space-y-1.5 shrink-0 overflow-hidden">
        <Link
          href="/admin/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-3 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all group overflow-hidden whitespace-nowrap",
            pathname === "/admin/settings" && "bg-white/10 text-white"
          )}
        >
          <Settings className="w-5 h-5 shrink-0 group-hover:text-teal" />
          <span className={cn(
            "text-[14.5px] transition-all duration-300",
            isCollapsed ? "opacity-0 -translate-x-4 invisible" : "opacity-100 translate-x-0 visible"
          )}>
            Settings
          </span>
        </Link>
        
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-gray-400 hover:text-coral hover:bg-coral/5 transition-all group text-left overflow-hidden whitespace-nowrap"
        >
          <LogOut className="w-5 h-5 shrink-0 group-hover:text-coral" />
          <span className={cn(
            "text-[14.5px] transition-all duration-300",
            isCollapsed ? "opacity-0 -translate-x-4 invisible" : "opacity-100 translate-x-0 visible"
          )}>
            Sign Out
          </span>
        </button>
      </div>
    </aside>
  )
}
