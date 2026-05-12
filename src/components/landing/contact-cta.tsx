"use client"

import { Button } from "@/components/ui/button"
import { openMockupModal } from "@/components/landing/mockup-modal"
import { useAgency } from "@/components/providers/agency-provider"
import { ArrowRight, Mail, Phone } from "lucide-react"

export function ContactCTA() {
  const { agency_name, contact_email, phone_number } = useAgency()

  return (
    <section id="contact" className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-40 -z-10" />
      <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
        <div className="bg-navy rounded-[48px] p-8 sm:p-16 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-teal/20 blur-[100px] -z-10" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-coral/10 blur-[80px] -z-10" />
          
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-[13px] font-bold tracking-[0.2em] text-teal uppercase mb-4">Let's Talk</h2>
              <h3 className="text-[36px] sm:text-[48px] font-black text-white tracking-tight leading-tight mb-6">
                Ready to transform <br />
                your <span className="text-teal">digital identity?</span>
              </h3>
              <p className="text-gray-400 text-[18px] leading-relaxed mb-10">
                Join 300+ founders who trusted {agency_name} to build their 
                online presence. Your free mockup is just one click away.
              </p>
              
              <div className="space-y-6">
                <div className="flex items-center gap-4 group">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 grid place-items-center group-hover:bg-teal/20 transition">
                    <Mail className="w-5 h-5 text-teal" />
                  </div>
                  <div>
                    <p className="text-[12px] text-gray-500 font-bold uppercase tracking-wider">Email Us</p>
                    <p className="text-white font-medium">{contact_email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 group">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 grid place-items-center group-hover:bg-teal/20 transition">
                    <Phone className="w-5 h-5 text-teal" />
                  </div>
                  <div>
                    <p className="text-[12px] text-gray-500 font-bold uppercase tracking-wider">Call Us</p>
                    <p className="text-white font-medium">{phone_number}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-md rounded-[32px] p-8 border border-white/10">
              <h4 className="text-[20px] font-bold text-white mb-2">Get a free mockup</h4>
              <p className="text-gray-400 text-[14px] mb-8">We'll design a custom homepage for your brand in under 24 hours. No strings attached.</p>
              
              <Button 
                onClick={openMockupModal}
                className="w-full h-14 rounded-2xl bg-teal text-navy font-bold text-[16px] hover:bg-teal/90 transition flex items-center justify-center gap-3"
              >
                Claim Your Free Mockup
                <ArrowRight className="w-5 h-5" />
              </Button>
              
              <p className="text-[12px] text-center text-gray-500 mt-6">
                Trusted by startups, e-commerce brands, and professional services worldwide.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
