"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { X, ArrowRight, Loader2 } from "lucide-react"

let openModalFn: (() => void) | null = null

export function openMockupModal() {
  openModalFn?.()
}

export function MockupModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [website, setWebsite] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  openModalFn = useCallback(() => setIsOpen(true), [])

  const handleClose = () => {
    setIsOpen(false)
    setEmail("")
    setWebsite("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // In production, send to your API
      await new Promise((resolve) => setTimeout(resolve, 1500))

      toast({
        title: "Request sent!",
        description: "We'll reply in under 2 hours with your free mockup.",
        variant: "success",
      })

      handleClose()
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
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
                  <h3 className="text-[22px] font-bold tracking-tight">Get your free mockup</h3>
                  <p className="text-[14px] text-gray-600 mt-1">We'll reply in under 2 hours.</p>
                </div>
                <button
                  onClick={handleClose}
                  className="w-8 h-8 grid place-items-center rounded-xl hover:bg-gray-100 text-gray-500 transition -mr-1 -mt-1"
                >
                  <X className="w-[18px] h-[18px]" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <Label className="text-[13px] font-medium text-gray-700">Work email</Label>
                  <Input
                    type="email"
                    required
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label className="text-[13px] font-medium text-gray-700">Website or idea</Label>
                  <Input
                    type="text"
                    placeholder="Hembox.io.com or describe it"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 mt-2 rounded-xl bg-navy text-white font-semibold text-[15px] hover:bg-navy/90 transition flex items-center justify-center gap-2"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <span>Request mockup</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
                <p className="text-[12px] text-center text-gray-500 pt-1">Free • No spam • Cancel anytime</p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}