"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { ArrowRight, Globe, Search, Palette, ShoppingCart, Megaphone, LifeBuoy, Code, Smartphone, Rocket, Shield, Zap, Layout, Cpu, Heart, Layers, MessageSquare, Database, Cloud, Lock, BarChart, Target, PenTool, MousePointer2, Camera, GraduationCap, School } from "lucide-react"

const ICON_MAP: Record<string, any> = { Globe, Search, Palette, ShoppingCart, Megaphone, LifeBuoy, Code, Smartphone, Rocket, Shield, Zap, Layout, Cpu, Heart, Layers, MessageSquare, Database, Cloud, Lock, BarChart, Target, PenTool, MousePointer2, Camera, GraduationCap, School }

interface Service {
  id: string
  title: string
  description: string
  icon_name: string
  slug?: string | null
  page_type?: "family" | "product"
  pricing_model?: "fixed" | "starting_from" | "quote" | "packages"
  price_amount?: number | null
  price_currency?: string | null
  price_suffix?: string | null
}

function priceLabel(service: Service) {
  if (service.pricing_model === "packages") return "View packages"
  if (service.pricing_model === "quote" || service.price_amount == null) return "Request a quote"
  const amount = new Intl.NumberFormat("en-ZM", { maximumFractionDigits: 0 }).format(Number(service.price_amount))
  const prefix = service.pricing_model === "starting_from" ? "From " : ""
  return `${prefix}${service.price_currency === "USD" ? "$" : "K"}${amount}${service.price_suffix ? ` ${service.price_suffix}` : ""}`
}

export function ServicesSection() {
  const [services, setServices] = useState<Service[]>([])
  const supabase = useMemo(() => isSupabaseConfigured() ? createClient() : null, [])

  useEffect(() => {
    if (!supabase) return
    const fetchServices = async () => {
      try {
        const { data, error } = await supabase
          .from("services")
          .select("id,title,description,icon_name,slug,page_type,pricing_model,price_amount,price_currency,price_suffix")
          .eq("status", "active")
          .is("parent_service_id", null)
          .order("sort_order", { ascending: true })
        if (error) throw error
        setServices((data || []) as Service[])
      } catch (error) {
        console.warn("Unable to load services:", error)
      }
    }
    void fetchServices()
  }, [supabase])

  if (services.length === 0) return null

  return (
    <section id="services" className="py-24 relative overflow-hidden">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-[13px] font-bold tracking-[0.2em] text-coral uppercase mb-3">Our Solutions</h2>
          <h3 className="text-[32px] sm:text-[40px] font-black tracking-tight text-navy leading-tight">The right digital solution for <span className="text-teal">what comes next.</span></h3>
          <p className="mt-4 text-gray-600 text-[16px] sm:text-[18px]">Explore focused services and complete solution families. Each offering has its own scope, deliverables and pricing.</p>
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
                <div className="mt-6 flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-navy group-hover:text-teal transition-colors">{service.page_type === "family" ? "Explore solutions" : "Explore service"} <ArrowRight className="inline w-4 h-4" /></span>
                  <span className="text-xs font-semibold text-gray-500 text-right">{priceLabel(service)}</span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
