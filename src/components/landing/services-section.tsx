"use client"

import { Globe, Search, Palette, ShoppingCart, Megaphone, LifeBuoy } from "lucide-react"

const services = [
  {
    title: "Web Design & Development",
    description: "Modern, responsive websites built with the latest technologies. Mobile-first and conversion-focused.",
    icon: Globe,
    color: "bg-teal/10 text-teal",
  },
  {
    title: "SEO Optimization",
    description: "Drive organic traffic and rank higher on Google. We optimize your visibility for real business growth.",
    icon: Search,
    color: "bg-coral/10 text-coral",
  },
  {
    title: "Brand Identity",
    description: "Logos, visual systems, and brand guidelines that make your business unforgettable and unique.",
    icon: Palette,
    color: "bg-navy/10 text-navy",
  },
  {
    title: "E-commerce Solutions",
    description: "Scalable online stores that sell. From inventory management to seamless checkout experiences.",
    icon: ShoppingCart,
    color: "bg-teal/10 text-teal",
  },
  {
    title: "Google & Meta Ads",
    description: "Targeted advertising campaigns that maximize your ROI. You pay for customers, not just clicks.",
    icon: Megaphone,
    color: "bg-coral/10 text-coral",
  },
  {
    title: "Technical Support",
    description: "12 months of free support with every project. We're here to keep your business running smoothly.",
    icon: LifeBuoy,
    color: "bg-navy/10 text-navy",
  },
]

export function ServicesSection() {
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
          {services.map((service, index) => (
            <div 
              key={index}
              className="group p-8 rounded-[32px] bg-white border border-black/5 hover:border-teal/20 hover:shadow-xl hover:shadow-teal/5 transition-all duration-300"
            >
              <div className={`w-14 h-14 rounded-2xl ${service.color} grid place-items-center mb-6 group-hover:scale-110 transition-transform`}>
                <service.icon className="w-7 h-7" />
              </div>
              <h4 className="text-[20px] font-bold text-navy mb-3">{service.title}</h4>
              <p className="text-gray-600 leading-relaxed text-[15px]">
                {service.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
