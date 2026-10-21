"use client"

import { useState } from "react"
import Link from "next/link"
import { useAuth } from "@/components/providers/auth-provider"
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

  return (
    <header className="fixed top-0 w-full z-50 border-b border-black/[0.05] bg-white/70 backdrop-blur-xl">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
        <div className="flex h-[72px] items-center justify-between">
          <Link href="/" aria-label="HEMBOX.io home" className="group inline-flex shrink-0 items-center">
            <span
              aria-hidden="true"
              className="h-10 w-[226px] shrink-0 bg-navy transition-colors duration-200 group-hover:bg-gradient-to-r group-hover:from-teal group-hover:to-coral"
              style={{
                maskImage: "url('/hembox-logo.svg')",
                maskRepeat: "no-repeat",
                maskPosition: "left center",
                maskSize: "contain",
                WebkitMaskImage: "url('/hembox-logo.svg')",
                WebkitMaskRepeat: "no-repeat",
                WebkitMaskPosition: "left center",
                WebkitMaskSize: "contain",
              }}
            />
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <a href="/#services" className="text-[14.5px] font-medium text-gray-600 hover:text-navy transition">Services</a>
            <a href="/#work" className="text-[14.5px] font-medium text-gray-600 hover:text-navy transition">Work</a>
            <Link href="/pricing" className="text-[14.5px] font-medium text-gray-600 hover:text-navy transition">Pricing</Link>
            <a href="/#contact" className="text-[14.5px] font-medium text-gray-600 hover:text-navy transition">Contact</a>
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
            <a href="/#services" className="py-2 text-[15px] font-medium" onClick={() => setMobileMenuOpen(false)}>Services</a>
            <a href="/#work" className="py-2 text-[15px] font-medium" onClick={() => setMobileMenuOpen(false)}>Work</a>
            <Link href="/pricing" className="py-2 text-[15px] font-medium" onClick={() => setMobileMenuOpen(false)}>Pricing</Link>
            <a href="/#contact" className="py-2 text-[15px] font-medium" onClick={() => setMobileMenuOpen(false)}>Contact</a>
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
