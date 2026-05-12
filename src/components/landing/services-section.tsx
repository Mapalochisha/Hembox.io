"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Globe, Search, Palette, ShoppingCart, Megaphone, LifeBuoy } from "lucide-react"

const ICON_MAP: Record<string, any> = {
  Globe,
  Search,
  Palette,
  ShoppingCart,
  Megaphone,
  LifeBuoy,
}

interface Service {
  id: string
  title: string
  description: string
  icon_name: string
}

export function ServicesSection() {
  const [services, setServices] = useState<Service[]>([])
  const supabase = createClient()

  useEffect(() => {
    const fetchServices = async () => {
      const { data } = await supabase
        .from('services')
        .select('*')
        .eq('status', 'active')
        .order('sort_order', { ascending: true })
      
      if (data) setServices(data)
    }

    fetchServices()
  }, [])

  // If no services in DB, don't show section or show skeleton? 
  // For now, let's just return null if empty to keep it clean.
  if (services.length === 0) return null

  return (
    <section id="services" className="py-24 relative overflow-hidden">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-[13px] font-bold tracking-[0.2em] text-coral uppercase mb-3">Our Services</h2>
          <h3 className="text-[32px] sm:text-[40px] font-black tracking-tight text-navy leading-tight">
            Everything you need for a <span className="text-teal">powerful</span> digital presence.
          </h3>
          <p className="mt-4 text-gray-600 text-[16px] sm:text-[18px]">
            We provide comprehensive digital solutions tailored to your business goals. 
            From initial design to ongoing growth.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service, index) => {
            const Icon = ICON_MAP[service.icon_name] || Globe
            return (
              <div 
                key={service.id}
                className="group p-8 rounded-[32px] bg-white border border-black/5 hover:border-teal/20 hover:shadow-xl hover:shadow-teal/5 transition-all duration-300"
              >
                <div className="w-14 h-14 rounded-2xl bg-teal/10 text-teal grid place-items-center mb-6 group-hover:scale-110 transition-transform">
                  <Icon className="w-7 h-7" />
                </div>
                <h4 className="text-[20px] font-bold text-navy mb-3">{service.title}</h4>
                <p className="text-gray-600 leading-relaxed text-[15px]">
                  {service.description}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
