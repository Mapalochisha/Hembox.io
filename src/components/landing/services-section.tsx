"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { ArrowRight, Globe, Search, Palette, ShoppingCart, Megaphone, LifeBuoy, Code, Smartphone, Rocket, Shield, Zap, Layout, Cpu, Heart, Layers, MessageSquare, Database, Cloud, Lock, BarChart, Target, PenTool, MousePointer2, Camera, GraduationCap, School } from "lucide-react"

const ICON_MAP: Record<string, any> = { Globe, Search, Palette, ShoppingCart, Megaphone, LifeBuoy, Code, Smartphone, Rocket, Shield, Zap, Layout, Cpu, Heart, Layers, MessageSquare, Database, Cloud, Lock, BarChart, Target, PenTool, MousePointer2, Camera, GraduationCap, School }

interface Service { id: string; title: string; description: string; icon_name: string; slug?: string | null }

export function ServicesSection() {
  const [services, setServices] = useState<Service[]>([])
  const supabase = createClient()

  useEffect(() => {
    const fetchServices = async () => {
      const { data } = await supabase.from("services").select("*").eq("status", "active").order("sort_order", { ascending: true })
      if (data) setServices(data as Service[])
    }
    fetchServices()
  }, [])

  if (services.length === 0) return null

  return (
    <section id="services" className="py-24 relative overflow-hidden">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-[13px] font-bold tracking-[0.2em] text-coral uppercase mb-3">Our Services</h2>
          <h3 className="text-[32px] sm:text-[40px] font-black tracking-tight text-navy leading-tight">Everything you need for a <span className="text-teal">powerful</span> digital presence.</h3>
          <p className="mt-4 text-gray-600 text-[16px] sm:text-[18px]">We provide comprehensive digital solutions tailored to your business goals. From initial design to ongoing growth.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service) => {
            const Icon = ICON_MAP[service.icon_name] || Globe
            const slug = service.slug || service.id
            return (
              <Link key={service.id} href={`/services/${slug}`} className="group p-8 rounded-[32px] bg-white border border-black/5 hover:border-teal/20 hover:shadow-xl hover:shadow-teal/5 transition-all duration-300 block focus:outline-none focus:ring-2 focus:ring-teal/50">
                <div className="flex items-start justify-between gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-teal/10 text-teal grid place-items-center mb-6 group-hover:scale-110 transition-transform"><Icon className="w-7 h-7" /></div>
                  <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-teal group-hover:translate-x-1 transition-all mt-2" />
                </div>
                <h4 className="text-[20px] font-bold text-navy mb-3 group-hover:text-teal transition-colors">{service.title}</h4>
                <p className="text-gray-600 leading-relaxed text-[15px]">{service.description}</p>
                <span className="inline-flex items-center gap-2 mt-6 text-sm font-bold text-navy group-hover:text-teal transition-colors">Explore service <ArrowRight className="w-4 h-4" /></span>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
