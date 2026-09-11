"use client"

import { ArrowRight } from "lucide-react"
import { openMockupModal } from "@/components/landing/mockup-modal"

export function ServiceProjectCTA({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => openMockupModal("quote")}
      className={`inline-flex h-[52px] px-8 rounded-full bg-navy text-white font-bold items-center gap-2 hover:bg-navy/90 transition ${className}`}
    >
      Start Your Project <ArrowRight className="w-4 h-4" />
    </button>
  )
}

export function ServiceProjectCTASecondary() {
  return (
    <button
      type="button"
      onClick={() => openMockupModal("quote")}
      className="inline-flex mt-8 h-[54px] px-9 rounded-full bg-teal text-navy font-black items-center gap-2 hover:bg-teal/90 transition"
    >
      Start Your Project <ArrowRight className="w-4 h-4" />
    </button>
  )
}
