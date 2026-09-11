"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { openMockupModal } from "@/components/landing/mockup-modal"

export function ServiceProjectCTA({ className = "", serviceName = "" }: { className?: string; serviceName?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <button
        type="button"
        onClick={() => openMockupModal("contact", serviceName ? { service: serviceName } : undefined)}
        className="inline-flex h-[52px] px-8 rounded-full bg-navy text-white font-bold items-center gap-2 hover:bg-navy/90 transition"
      >
        Start Your Project <ArrowRight className="w-4 h-4" />
      </button>
      <Link
        href="/pricing"
        className="inline-flex h-[52px] px-7 rounded-full border border-gray-200 bg-white text-navy font-bold items-center gap-2 hover:border-teal hover:bg-teal/5 transition"
      >
        View Pricing <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  )
}

export function ServiceProjectCTASecondary({ serviceName = "" }: { serviceName?: string }) {
  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
      <button
        type="button"
        onClick={() => openMockupModal("contact", serviceName ? { service: serviceName } : undefined)}
        className="inline-flex h-[54px] px-9 rounded-full bg-teal text-navy font-black items-center gap-2 hover:bg-teal/90 transition"
      >
        Start Your Project <ArrowRight className="w-4 h-4" />
      </button>
      <Link
        href="/pricing"
        className="inline-flex h-[54px] px-8 rounded-full border border-gray-200 bg-white text-navy font-bold items-center gap-2 hover:border-teal hover:bg-teal/5 transition"
      >
        View Pricing <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  )
}
