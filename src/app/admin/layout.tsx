"use client"

import { Sidebar } from "@/components/admin/sidebar"
import { useAuth } from "@/components/providers/auth-provider"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useAdmin } from "@/hooks/use-admin"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isAdmin, isLoading } = useAdmin()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal"></div>
      </div>
    )
  }

  if (!isAdmin) return null

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <main className="flex-1 transition-all duration-300 ml-[80px] lg:ml-[280px]">
        <header className="h-[72px] bg-white border-b border-black/5 px-8 flex items-center justify-between sticky top-0 z-40">
          <h2 className="text-[14px] font-semibold text-gray-500 uppercase tracking-wider">Admin Area</h2>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-[14px] font-bold text-navy">Admin User</p>
              <p className="text-[12px] text-gray-500">Global Admin</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-navy text-white flex items-center justify-center font-bold">
              A
            </div>
          </div>
        </header>
        <div className="p-8 max-w-[1400px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
