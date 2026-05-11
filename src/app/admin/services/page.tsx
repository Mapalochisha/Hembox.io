"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Globe, Search, Palette, ShoppingCart, Megaphone, LifeBuoy, Plus } from "lucide-react"

const services = [
  { title: "Web Design & Development", icon: Globe, status: "active" },
  { title: "SEO Optimization", icon: Search, status: "active" },
  { title: "Brand Identity", icon: Palette, status: "active" },
  { title: "E-commerce Solutions", icon: ShoppingCart, status: "inactive" },
  { title: "Google & Meta Ads", icon: Megaphone, status: "active" },
  { title: "Technical Support", icon: LifeBuoy, status: "active" },
]

export default function AdminServicesPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-navy">Service Offerings</h1>
          <p className="text-gray-600 mt-1">Manage the services displayed on your homepage</p>
        </div>
        <Button className="bg-teal text-navy font-bold hover:bg-teal/90 gap-2">
          <Plus className="w-4 h-4" />
          Add Service
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.map((service, index) => (
          <Card key={index} className="group hover:border-teal/50 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="w-10 h-10 rounded-lg bg-teal/10 flex items-center justify-center">
                <service.icon className="w-5 h-5 text-teal" />
              </div>
              <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                service.status === 'active' ? 'bg-teal/10 text-teal' : 'bg-gray-100 text-gray-400'
              }`}>
                {service.status}
              </span>
            </CardHeader>
            <CardContent>
              <CardTitle className="text-[18px] mb-4 group-hover:text-teal transition-colors">{service.title}</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 rounded-lg">Edit</Button>
                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-coral">Hide</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
