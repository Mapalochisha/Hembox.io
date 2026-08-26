"use client"

import { Button } from "@/components/ui/button"
import { openMockupModal } from "@/components/landing/mockup-modal"
import { useAgency } from "@/components/providers/agency-provider"
import { ArrowRight, Mail, Phone, Instagram, Facebook, Twitter, Linkedin, MessageCircle } from "lucide-react"

export function ContactCTA() {
  const { 
    agency_name, 
    contact_email, 
    phone_number,
    whatsapp_number,
    whatsapp_message,
    instagram_url,
    facebook_url,
    twitter_url,
    linkedin_url
  } = useAgency()

  const whatsappUrl = whatsapp_number 
    ? `https://wa.me/${whatsapp_number.replace(/\D/g, '')}?text=${encodeURIComponent(whatsapp_message || "Hi, I'm interested in your services!")}`
    : null

  const socialLinks = [
    { icon: Instagram, href: instagram_url, label: "Instagram" },
    { icon: Facebook, href: facebook_url, label: "Facebook" },
    { icon: Twitter, href: twitter_url, label: "Twitter" },
    { icon: Linkedin, href: linkedin_url, label: "LinkedIn" },
  ].filter(link => link.href)

  return (
    <section id="contact" className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-40 -z-10" />
      <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
        <div className="bg-navy rounded-[32px] sm:rounded-[48px] p-6 sm:p-16 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[300px] h-[300px] sm:w-[400px] sm:h-[400px] bg-teal/20 blur-[80px] sm:blur-[100px] -z-10" />
          <div className="absolute bottom-0 left-0 w-[200px] h-[200px] sm:w-[300px] sm:h-[300px] bg-coral/10 blur-[60px] sm:blur-[80px] -z-10" />
          
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="text-left">
              <h2 className="text-[13px] font-bold tracking-[0.2em] text-teal uppercase mb-4">Let's Talk</h2>
              <h3 className="text-[32px] sm:text-[48px] font-black text-white tracking-tight leading-[1.1] mb-6">
                Ready to transform <br className="hidden sm:block" />
                your <span className="text-teal text-nowrap">digital identity?</span>
              </h3>
              <p className="text-gray-400 text-[16px] sm:text-[18px] leading-relaxed mb-10 max-w-[500px]">
                Join 50+ founders who trusted {agency_name} to build their 
                online presence. Your free mockup is just one click away.
              </p>
              
              <div className="space-y-5">
                <a href={`mailto:${contact_email}`} className="flex items-center gap-4 group w-fit">
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white/5 border border-white/10 grid place-items-center group-hover:bg-teal/20 group-hover:border-teal/30 transition shrink-0">
                    <Mail className="w-5 h-5 text-teal" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] sm:text-[12px] text-gray-500 font-bold uppercase tracking-wider">Email Us</p>
                    <p className="text-white font-medium text-[15px] sm:text-[16px] truncate">{contact_email}</p>
                  </div>
                </a>
                
                <div className="flex flex-wrap gap-x-8 gap-y-5">
                  <a href={`tel:${phone_number}`} className="flex items-center gap-4 group w-fit">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white/5 border border-white/10 grid place-items-center group-hover:bg-teal/20 group-hover:border-teal/30 transition shrink-0">
                      <Phone className="w-5 h-5 text-teal" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] sm:text-[12px] text-gray-500 font-bold uppercase tracking-wider">Call Us</p>
                      <p className="text-white font-medium text-[15px] sm:text-[16px] truncate">{phone_number}</p>
                    </div>
                  </a>

                  {whatsappUrl && (
                    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 group w-fit">
                      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white/5 border border-white/10 grid place-items-center group-hover:bg-[#25D366]/20 group-hover:border-[#25D366]/30 transition shrink-0">
                        <MessageCircle className="w-5 h-5 text-[#25D366]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] sm:text-[12px] text-gray-500 font-bold uppercase tracking-wider">WhatsApp</p>
                        <p className="text-white font-medium text-[15px] sm:text-[16px] truncate">Chat with us</p>
                      </div>
                    </a>
                  )}
                </div>
              </div>

              {socialLinks.length > 0 && (
                <div className="mt-12 pt-8 border-t border-white/5">
                  <p className="text-[11px] text-gray-500 font-bold uppercase tracking-[0.2em] mb-4">Follow Us</p>
                  <div className="flex gap-4">
                    {socialLinks.map((social, i) => (
                      <a 
                        key={i}
                        href={social.href} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-teal hover:bg-teal/10 hover:border-teal/30 transition-all"
                        title={social.label}
                      >
                        <social.icon className="w-5 h-5" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white/5 backdrop-blur-md rounded-[28px] sm:rounded-[32px] p-6 sm:p-8 border border-white/10 w-full">
              <h4 className="text-[18px] sm:text-[20px] font-bold text-white mb-2">Get a free mockup</h4>
              <p className="text-gray-400 text-[13px] sm:text-[14px] mb-8">We'll design a custom homepage for your brand in under 24 hours. No strings attached.</p>
              
              <Button 
                onClick={openMockupModal}
                className="w-full h-12 sm:h-14 rounded-xl sm:rounded-2xl bg-teal text-navy font-bold text-[15px] sm:text-[16px] hover:bg-teal/90 transition flex items-center justify-center gap-3"
              >
                Claim Your Free Mockup
                <ArrowRight className="w-5 h-5" />
              </Button>
              
              <p className="text-[11px] sm:text-[12px] text-center text-gray-500 mt-6 leading-relaxed">
                Trusted by startups, e-commerce brands, and professional services worldwide.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
