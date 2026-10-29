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

  const closeMobileMenu = () => setMobileMenuOpen(false)

  return (
    <header className="fixed top-0 z-50 w-full border-b border-black/[0.05] bg-white/90 backdrop-blur-xl">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between sm:h-[72px]">
          <Link
            href="/"
            aria-label="Hembox Tech home"
            onClick={closeMobileMenu}
            className="group inline-flex shrink-0 items-center"
          >
            <span
              aria-hidden="true"
              className="h-7 w-[158px] shrink-0 bg-navy transition-colors duration-200 group-hover:bg-gradient-to-r group-hover:from-teal group-hover:to-coral sm:h-9 sm:w-[203px]"
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

          <nav aria-label="Main navigation" className="hidden items-center gap-8 md:flex">
            <a href="/#services" className="text-[14.5px] font-medium text-gray-600 transition hover:text-navy">Services</a>
            <a href="/#work" className="text-[14.5px] font-medium text-gray-600 transition hover:text-navy">Work</a>
            <Link href="/pricing" className="text-[14.5px] font-medium text-gray-600 transition hover:text-navy">Pricing</Link>
            <Link href="/domains" className="text-[14.5px] font-medium text-gray-600 transition hover:text-navy">Domains</Link>
            <a href="/#contact" className="text-[14.5px] font-medium text-gray-600 transition hover:text-navy">Contact</a>
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Open account menu"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-bold text-white shadow-lg shadow-navy/10 transition hover:bg-navy/90 sm:h-10 sm:w-10"
                  >
                    {user.full_name?.charAt(0) || user.email?.charAt(0) || "U"}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="mt-2 w-56">
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-medium">{user.full_name || user.email}</p>
                    <p className="truncate text-xs text-gray-500">{user.email}</p>
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
                  className="hidden h-9 items-center rounded-full border border-gray-200 px-4 text-[13.5px] font-semibold transition hover:bg-gray-50 md:inline-flex"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="hidden h-9 items-center rounded-full bg-navy px-4 text-[13.5px] font-semibold text-white transition hover:bg-navy/90 md:inline-flex"
                >
                  Get started
                </Link>
              </>
            )}

            <button
              type="button"
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="grid h-10 w-10 place-items-center rounded-xl border border-black/10 transition hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal md:hidden"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div
          id="mobile-navigation"
          className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-black/5 bg-white shadow-lg md:hidden"
        >
          <nav aria-label="Mobile navigation" className="mx-auto flex max-w-[1200px] flex-col gap-1 px-4 py-3 sm:px-6">
            <a href="/#services" onClick={closeMobileMenu} className="rounded-xl px-3 py-3 text-[15px] font-medium text-gray-700 transition hover:bg-gray-50 hover:text-navy">Services</a>
            <a href="/#work" onClick={closeMobileMenu} className="rounded-xl px-3 py-3 text-[15px] font-medium text-gray-700 transition hover:bg-gray-50 hover:text-navy">Work</a>
            <Link href="/pricing" onClick={closeMobileMenu} className="rounded-xl px-3 py-3 text-[15px] font-medium text-gray-700 transition hover:bg-gray-50 hover:text-navy">Pricing</Link>
            <Link href="/domains" onClick={closeMobileMenu} className="rounded-xl px-3 py-3 text-[15px] font-medium text-gray-700 transition hover:bg-gray-50 hover:text-navy">Domains</Link>
            <a href="/#contact" onClick={closeMobileMenu} className="rounded-xl px-3 py-3 text-[15px] font-medium text-gray-700 transition hover:bg-gray-50 hover:text-navy">Contact</a>
            {!user && (
              <div className="mt-2 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4">
                <Link
                  href="/login"
                  onClick={closeMobileMenu}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-gray-200 px-4 text-sm font-semibold transition hover:bg-gray-50"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  onClick={closeMobileMenu}
                  className="inline-flex h-11 items-center justify-center rounded-full bg-navy px-4 text-sm font-semibold text-white transition hover:bg-navy/90"
                >
                  Get started
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
