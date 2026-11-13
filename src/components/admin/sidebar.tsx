"use client"

import Link from "next/link"
import { BRAND_NAME } from "@/lib/brand"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  BarChart3,
  Users,
  FolderKanban,
  Briefcase,
  Star,
  DollarSign,
  Globe2,
  ListChecks,
  CreditCard,
  Image,
  MessageSquare,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
} from "lucide-react"
import { useAuth } from "@/components/providers/auth-provider"
import { useSidebar } from "./sidebar-provider"
import { useState, useEffect } from "react"

type SidebarItem = {
  icon: React.ElementType
  label: string
  href: string
}

type SidebarGroup = {
  icon: React.ElementType
  label: string
  items: SidebarItem[]
}

const GROUPS: SidebarGroup[] = [
  {
    icon: LayoutDashboard,
    label: "Overview",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", href: "/admin/dashboard" },
      { icon: BarChart3, label: "Analytics", href: "/admin/analytics" },
    ],
  },
  {
    icon: Briefcase,
    label: "Clients & Work",
    items: [
      { icon: Users, label: "Clients", href: "/admin/clients" },
      { icon: FolderKanban, label: "Projects", href: "/admin/projects" },
      { icon: Briefcase, label: "Client Workspace", href: "/admin/client-workspace" },
      { icon: Briefcase, label: "Services", href: "/admin/services" },
      { icon: Star, label: "Portfolio", href: "/admin/portfolio" },
    ],
  },
  {
    icon: Globe2,
    label: "Domains",
    items: [
      { icon: Globe2, label: "Domains", href: "/admin/domains" },
      { icon: ListChecks, label: "Domain Orders", href: "/admin/domains/orders" },
      { icon: BarChart3, label: "Domain Margins", href: "/admin/domains/margins" },
      { icon: CreditCard, label: "Provider Prices", href: "/admin/domains/provider-prices" },
      { icon: ListChecks, label: "Domain Recovery", href: "/admin/domains/recovery" },
      { icon: Settings, label: "Domain Management", href: "/admin/domains/management" },
      { icon: Globe2, label: "Sandbox", href: "/admin/domains/sandbox" },
    ],
  },
  {
    icon: DollarSign,
    label: "Billing",
    items: [
      { icon: CreditCard, label: "Billing Invoices", href: "/admin/billing/invoices" },
      { icon: CreditCard, label: "Billing Claims", href: "/admin/billing/payments" },
      { icon: CreditCard, label: "Payment Arrangements", href: "/admin/billing/arrangements" },
      { icon: CreditCard, label: "Payment Methods", href: "/admin/billing/methods" },
      { icon: BarChart3, label: "Billing Reconciliation", href: "/admin/billing/reconciliation" },
      { icon: DollarSign, label: "Manual Payments", href: "/admin/domains/manual-payments" },
    ],
  },
  {
    icon: Image,
    label: "Content",
    items: [
      { icon: Image, label: "Media", href: "/admin/media" },
      { icon: MessageSquare, label: "Messages", href: "/admin/messages" },
    ],
  },
]

function SidebarItemLink({
  item,
  isCollapsed,
  isActive,
}: {
  item: SidebarItem
  isCollapsed: boolean
  isActive: boolean
}) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      title={isCollapsed ? item.label : undefined}
      className={cn(
        "flex items-center gap-3 rounded-xl transition-all group overflow-hidden whitespace-nowrap",
        isCollapsed
          ? "justify-center px-0 h-10 w-10 mx-auto"
          : "gap-3 px-3 py-2.5",
        isActive
          ? "bg-teal text-[#0F172A] font-semibold shadow-sm shadow-teal/20"
          : "text-gray-400 hover:text-white hover:bg-white/5"
      )}
    >
      <Icon
        className={cn(
          "w-4 h-4 shrink-0",
          isActive ? "text-[#0F172A]" : "group-hover:text-teal"
        )}
      />
      {!isCollapsed && <span className="text-[13.5px]">{item.label}</span>}
    </Link>
  )
}

function SidebarGroup({
  group,
  isCollapsed,
  openGroups,
  toggleGroup,
}: {
  group: SidebarGroup
  isCollapsed: boolean
  openGroups: Set<string>
  toggleGroup: (label: string) => void
}) {
  const Icon = group.icon
  const pathname = usePathname()
  const isOpen = openGroups.has(group.label)
  const groupHasActive = group.items.some((i) => i.href === pathname)

  const handleHeaderClick = () => toggleGroup(group.label)

  return (
    <div key={group.label} className="mb-2 overflow-hidden rounded-xl border border-white/5 bg-white/5 transition-all duration-300">
      <button
        onClick={handleHeaderClick}
        className={cn(
          "flex items-center justify-between w-full px-3 py-3 transition-all",
          groupHasActive ? "bg-teal/10" : "hover:bg-white/10"
        )}
      >
        <div className="flex items-center gap-3">
          <Icon
            className={cn(
              "w-4 h-4 shrink-0",
              isOpen ? "text-teal" : "text-gray-400 group-hover:text-teal"
            )}
          />
          {!isCollapsed && (
            <span className="text-[13px] font-medium text-gray-300 group-hover:text-white truncate flex-1">
              {group.label}
            </span>
          )}
        </div>
        {!isCollapsed && (
          <ChevronRight
            className={cn(
              "w-4 h-4 shrink-0 text-gray-500 transition-transform duration-200",
              isOpen ? "rotate-90" : ""
            )}
          />
        )}
      </button>

      {/* Collapsible items */}
      <div
        className={cn(
          "transition-all duration-300 ease-out",
          !isOpen || isCollapsed
            ? "max-h-0 opacity-0 overflow-hidden mt-0 pb-0"
            : "max-h-[500px] opacity-100 overflow-visible mt-1 pb-1"
        )}
      >
        {group.items.map((item) => {
          const isActive = pathname === item.href
          return (
            <SidebarItemLink
              key={item.href}
              item={item}
              isCollapsed={isCollapsed}
              isActive={isActive}
            />
          )
        })}
      </div>
    </div>
  )
}

export function Sidebar() {
  const { isCollapsed, toggleSidebar } = useSidebar()
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(["Overview"]))
  const pathname = usePathname()
  const { signOut } = useAuth()

  // Auto-open the group containing the active route when navigation changes
  useEffect(() => {
    const activeGroupLabel = GROUPS.find((g) =>
      g.items.some((i) => i.href === pathname)
    )?.label
    if (activeGroupLabel) {
      setOpenGroups((prev) => {
        const next = new Set(prev)
        next.add(activeGroupLabel)
        return next
      })
    }
  }, [pathname])

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-[#0F172A] transition-all duration-300 z-50 flex flex-col border-r border-white/5 shadow-2xl",
        isCollapsed ? "w-[80px]" : "w-[280px]"
      )}
    >
      {/* Logo & Toggle Area */}
      <div
        className={cn(
          "h-[72px] flex items-center border-b border-white/5 shrink-0 transition-all duration-300",
          isCollapsed ? "justify-center px-0" : "justify-between px-4"
        )}
      >
        <Link
          href="/"
          className={cn(
            "flex items-center gap-3 group transition-all duration-300",
            isCollapsed ? "pl-0" : "pl-2"
          )}
        >
          <div className="w-8 h-8 rounded-lg bg-teal flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M4 4h7v7H4zM13 4h7v4h-7zM4 13h4v7H4zM13 11h7v9h-7z" fill="#0F172A" />
            </svg>
          </div>
          {!isCollapsed && (
            <span className="text-[17px] font-bold text-white tracking-tight whitespace-nowrap">
              {BRAND_NAME}
            </span>
          )}
        </Link>

        {!isCollapsed && (
          <button
            onClick={toggleSidebar}
            className="h-9 w-9 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all shrink-0"
          >
            <PanelLeftClose className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Collapse Toggle for Mini Sidebar */}
      {isCollapsed && (
        <div className="py-4 flex justify-center border-b border-white/5">
          <button
            onClick={toggleSidebar}
            className="h-9 w-9 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <PanelLeftOpen className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {GROUPS.map((group) => (
            <SidebarGroup
              key={group.label}
              group={group}
              isCollapsed={isCollapsed}
              openGroups={openGroups}
              toggleGroup={toggleGroup}
            />
          ))}
      </nav>

      {/* Footer Area */}
      <div className="p-3 border-t border-white/5 space-y-1 shrink-0 overflow-hidden">
        <Link
          href="/admin/settings"
          title={isCollapsed ? "Settings" : undefined}
          className={cn(
            "flex items-center rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all group overflow-hidden whitespace-nowrap",
            isCollapsed ? "justify-center px-0 h-10 w-10 mx-auto" : "gap-3 px-3 py-2.5",
            pathname === "/admin/settings" && "bg-white/10 text-white"
          )}
        >
          <Settings className="w-4 h-4 shrink-0 group-hover:text-teal" />
          {!isCollapsed && <span className="text-[13.5px]">Settings</span>}
        </Link>

        <button
          onClick={signOut}
          title={isCollapsed ? "Sign Out" : undefined}
          className={cn(
            "w-full flex items-center rounded-xl text-gray-400 hover:text-coral hover:bg-coral/5 transition-all group text-left overflow-hidden whitespace-nowrap",
            isCollapsed ? "justify-center px-0 h-10 w-10 mx-auto" : "gap-3 px-3 py-2.5"
          )}
        >
          <LogOut className="w-4 h-4 shrink-0 group-hover:text-coral" />
          {!isCollapsed && <span className="text-[13.5px]">Sign Out</span>}
        </button>
      </div>
    </aside>
  )
}
