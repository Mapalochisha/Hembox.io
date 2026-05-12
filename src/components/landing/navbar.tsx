"use client"

import { useState } from "react"
import Link from "next/link"
import { useAuth } from "@/components/providers/auth-provider"
import { useAgency } from "@/components/providers/agency-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Menu, X, User, LogOut, LayoutDashboard } from "lucide-react"

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { user, isAdmin, signOut } = useAuth()
  const { agency_name } = useAgency()

  return (
    <header className="fixed top-0 w-full z-50 border-b border-black/[0.05] bg-white/70 backdrop-blur-xl">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
        <div className="flex h-[72px] items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative w-9 h-9 rounded-xl bg-navy flex items-center justify-center overflow-hidden group-hover:scale-105 transition">
              <div className="absolute inset-0 bg-gradient-to-br from-teal to-coral opacity-0 group-hover:opacity-100 transition-opacity" />
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="relative z-10">
                <path d="M4 4h7v7H4zM13 4h7v4h-7zM4 13h4v7H4zM13 11h7v9h-7z" fill="white" />
              </svg>
            </div>
            <span className="text-[19px] font-[800] tracking-tight">{agency_name}</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <a href="#services" className="text-[14.5px] font-medium text-gray-600 hover:text-navy transition">Services</a>
            <a href="#work" className="text-[14.5px] font-medium text-gray-600 hover:text-navy transition">Work</a>
            <a href="#about" className="text-[14.5px] font-medium text-gray-600 hover:text-navy transition">Process</a>
            <a href="#contact" className="text-[14.5px] font-medium text-gray-600 hover:text-navy transition">Contact</a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-navy text-white flex items-center justify-center text-sm font-bold hover:bg-navy/90 transition shadow-lg shadow-navy/10 shrink-0">
                    {user.full_name?.charAt(0) || user.email?.charAt(0) || "U"}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 mt-2">
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium truncate">{user.full_name || user.email}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  {isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin/dashboard" className="cursor-pointer">
                        <LayoutDashboard className="mr-2 h-4 w-4 text-teal" />
                        Admin Dashboard
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="cursor-pointer">
                      <User className="mr-2 h-4 w-4 text-gray-400" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut} className="cursor-pointer text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden sm:inline-flex h-9 px-4 items-center rounded-full border border-gray-200 text-[13.5px] font-semibold hover:bg-gray-50 transition"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="inline-flex h-9 px-4 items-center rounded-full bg-navy text-white text-[13.5px] font-semibold hover:bg-navy/90 transition"
                >
                  Get started
                </Link>
              </>
            )}

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden w-9 h-9 grid place-items-center rounded-xl hover:bg-gray-100 transition border border-black/5"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-black/5 bg-white">
          <div className="px-6 py-4 flex flex-col gap-3">
            <a href="#services" className="py-2 text-[15px] font-medium">Services</a>
            <a href="#work" className="py-2 text-[15px] font-medium">Work</a>
            <a href="#about" className="py-2 text-[15px] font-medium">Process</a>
            <a href="#contact" className="py-2 text-[15px] font-medium">Contact</a>
            {!user && (
              <>
                <Link href="/login" className="py-2 text-[15px] font-medium text-teal">Sign in</Link>
                <Link href="/register" className="py-2 text-[15px] font-medium text-teal">Get started</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
