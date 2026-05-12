"use client"

import { useAgency } from "@/components/providers/agency-provider"

export function Footer() {
  const { agency_name } = useAgency()
  const year = new Date().getFullYear()

  return (
    <footer className="py-12 border-t border-black/5 relative">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-navy flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M4 4h7v7H4zM13 4h7v4h-7zM4 13h4v7H4zM13 11h7v9h-7z" fill="white" />
              </svg>
            </div>
            <span className="font-bold tracking-tight text-navy">{agency_name}</span>
          </div>
          <p className="text-gray-500 text-sm">© {year} {agency_name}. All rights reserved.</p>
          <div className="flex gap-8">
            <a href="/privacy" className="text-sm text-gray-500 hover:text-navy transition">Privacy</a>
            <a href="/terms" className="text-sm text-gray-500 hover:text-navy transition">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
