"use client"

import { useState, useCallback, type MouseEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { useAgency } from "@/components/providers/agency-provider"
import { X, ArrowRight, Loader2, Mail, Phone, MessageCircle } from "lucide-react"

type InquiryType = "mockup" | "quote" | "pricing" | "contact"

let openModalFn: ((type?: InquiryType) => void) | null = null

export function openMockupModal(typeOrEvent?: InquiryType | MouseEvent<HTMLButtonElement>) {
  const type = typeof typeOrEvent === "string" ? typeOrEvent : "mockup"
  openModalFn?.(type)
}

export function MockupModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [contact, setContact] = useState("")
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [inquiryType, setInquiryType] = useState<InquiryType>("mockup")
  const [honeypot, setHoneypot] = useState("")
  const { toast } = useToast()
  const { contact_email, phone_number, whatsapp_number, whatsapp_message } = useAgency()

  openModalFn = useCallback((type: InquiryType = "mockup") => {
    setInquiryType(type)
    setIsOpen(true)
  }, [])

  const handleClose = () => {
    setIsOpen(false)
    setContact("")
    setMessage("")
    setHoneypot("")
  }

  const isQuote = inquiryType === "quote" || inquiryType === "pricing"
  const title = isQuote ? "Request a custom quote" : "Get your free mockup"
  const description = isQuote
    ? "Tell us what you need and we'll get back to you."
    : "Tell us about your idea and we'll reply in under 2 hours."
  const buttonLabel = isQuote ? "Request quote" : "Request mockup"
  const whatsappUrl = whatsapp_number
    ? `https://wa.me/${whatsapp_number.replace(/\D/g, "")}?text=${encodeURIComponent(whatsapp_message || "Hi, I'm interested in your services!")}`
    : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: inquiryType,
          contact,
          message,
          source: typeof window !== "undefined" ? window.location.pathname : "website",
          honeypot,
        }),
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result.error || "Unable to send your request")
      }

      toast({
        title: "Request sent!",
        description: isQuote
          ? "Your custom quote request is now in our inbox."
          : "We'll reply in under 2 hours with your free mockup.",
        variant: "success",
      })

      handleClose()
    } catch (error) {
      toast({
        title: "Couldn't send request",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100]">
      <div
        className="absolute inset-0 bg-navy/60 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-[24px] bg-white shadow-2xl border border-black/5 overflow-hidden animate-in fade-in zoom-in duration-200">
          <div className="p-[1px] bg-gradient-to-b from-teal/30 to-coral/30">
            <div className="bg-white rounded-[23px] p-8">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="w-11 h-11 rounded-2xl bg-navy grid place-items-center mb-3">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <path d="M4 4h7v7H4zM13 4h7v4h-7zM4 13h4v7H4zM13 11h7v9h-7z" fill="white"/>
                    </svg>
                  </div>
                  <h3 className="text-[22px] font-bold tracking-tight">{title}</h3>
                  <p className="text-[14px] text-gray-600 mt-1">{description}</p>
                </div>
                <button
                  onClick={handleClose}
                  className="w-8 h-8 grid place-items-center rounded-xl hover:bg-gray-100 text-gray-500 transition -mr-1 -mt-1"
                  aria-label="Close"
                >
                  <X className="w-[18px] h-[18px]" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <Label className="text-[13px] font-medium text-gray-700">Email or WhatsApp number</Label>
                  <Input
                    type="text"
                    required
                    maxLength={254}
                    placeholder="you@company.com or +260 97..."
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label className="text-[13px] font-medium text-gray-700">Message or idea</Label>
                  <textarea
                    required
                    maxLength={2000}
                    placeholder="Tell us what you'd like us to build, improve or design..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="mt-1.5 min-h-[110px] w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-gray-400 focus:border-teal focus:ring-2 focus:ring-teal/20"
                  />
                </div>
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  className="absolute -left-[9999px] opacity-0 pointer-events-none"
                  aria-hidden="true"
                />
                <Button
                  type="submit"
                  className="w-full h-11 mt-2 rounded-xl bg-navy text-white font-semibold text-[15px] hover:bg-navy/90 transition flex items-center justify-center gap-2"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <span>{buttonLabel}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
                <p className="text-[12px] text-center text-gray-500 pt-1">Free • No spam • Cancel anytime</p>
              </form>

              {(contact_email || phone_number || whatsappUrl) && (
                <div className="mt-7 pt-6 border-t border-gray-100">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400 text-center mb-4">Or contact us directly</p>
                  <div className="flex justify-center gap-3">
                    {contact_email && (
                      <a
                        href={`mailto:${contact_email}`}
                        aria-label="Email Hembox.io"
                        title="Email us"
                        className="w-11 h-11 rounded-xl bg-gray-50 border border-gray-200 grid place-items-center text-navy hover:bg-teal/10 hover:border-teal/30 hover:text-teal transition"
                      >
                        <Mail className="w-5 h-5" />
                      </a>
                    )}
                    {phone_number && (
                      <a
                        href={`tel:${phone_number}`}
                        aria-label="Call Hembox.io"
                        title="Call us"
                        className="w-11 h-11 rounded-xl bg-gray-50 border border-gray-200 grid place-items-center text-navy hover:bg-teal/10 hover:border-teal/30 hover:text-teal transition"
                      >
                        <Phone className="w-5 h-5" />
                      </a>
                    )}
                    {whatsappUrl && (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Message Hembox.io on WhatsApp"
                        title="WhatsApp us"
                        className="w-11 h-11 rounded-xl bg-gray-50 border border-gray-200 grid place-items-center text-[#25D366] hover:bg-[#25D366]/10 hover:border-[#25D366]/30 transition"
                      >
                        <MessageCircle className="w-5 h-5" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
