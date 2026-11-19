"use client"

import { ArrowRight } from "lucide-react"
import { openMockupModal, type InquiryContext } from "@/components/landing/mockup-modal"

type Props = {
  className?: string
  serviceName?: string
  context?: InquiryContext
  label?: string
}

export function ServiceProjectCTA({ className = "", serviceName = "", context, label = "Request custom quote" }: Props) {
  const inquiryContext = context || (serviceName ? { service: serviceName } : undefined)
  return (
    <button
      type="button"
      onClick={() => openMockupModal("contact", inquiryContext)}
      className={`inline-flex h-[52px] px-8 rounded-full bg-navy text-white font-bold items-center gap-2 hover:bg-navy/90 transition ${className}`}
    >
      {label} <ArrowRight className="w-4 h-4" />
    </button>
  )
}

export function ServiceProjectCTASecondary({ serviceName = "", context }: { serviceName?: string; context?: InquiryContext }) {
  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
      <ServiceProjectCTA
        serviceName={serviceName}
        context={context}
        className="h-[54px] px-9 bg-teal text-navy font-black hover:bg-teal/90"
      />
    </div>
  )
}
