"use client"

import { useState, useEffect } from "react"
import { Navbar } from "@/components/landing/navbar"
import { Footer } from "@/components/landing/footer"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, ArrowRight, Loader2, Sparkles } from "lucide-react"
import { openMockupModal } from "@/components/landing/mockup-modal"
import { MockupModal } from "@/components/landing/mockup-modal"

interface PricingPackage {
  id: string
  name: string
  description: string
  price_amount: number
  price_suffix: string
  features: string[]
  is_popular: boolean
}

export default function PricingPage() {
  const [packages, setPackages] = useState<PricingPackage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const { data } = await supabase
          .from('pricing_packages')
          .select('*')
          .eq('status', 'active')
          .order('sort_order', { ascending: true })
        
        if (data) setPackages(data)
      } finally {
        setIsLoading(false)
      }
    }

    fetchPricing()
  }, [])

  return (
    <div className="relative min-h-screen isolate overflow-hidden bg-white">
      <div className="absolute inset-0 -z-20 grid-bg [mask-image:radial-gradient(ellipse_at_center,black_60%,transparent_100%)]" />
      
      <Navbar />

      <main className="pt-32 pb-24">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h1 className="text-[13px] font-bold tracking-[0.2em] text-coral uppercase mb-4">Pricing Plans</h1>
            <h2 className="text-[40px] sm:text-[56px] font-black tracking-tight text-navy leading-[1.1] mb-6">
              Simple, transparent <br />
              <span className="text-teal">pricing for founders.</span>
            </h2>
            <p className="text-gray-600 text-[18px] sm:text-[20px] leading-relaxed">
              Choose the perfect plan for your business needs. 
              All plans are fully customizable to fit your specific goals.
            </p>
          </div>

          {isLoading ? (
            <div className="h-[400px] flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-teal animate-spin" />
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-8">
              {packages.map((pkg) => (
                <Card 
                  key={pkg.id} 
                  className={cn(
                    "relative flex flex-col rounded-[32px] border-black/5 transition-all duration-500 hover:shadow-2xl hover:shadow-navy/5 overflow-hidden",
                    pkg.is_popular ? "border-teal/30 shadow-xl shadow-teal/5 scale-105 z-10" : "bg-white"
                  )}
                >
                  {pkg.is_popular && (
                    <div className="absolute top-0 inset-x-0 h-1.5 bg-teal" />
                  )}
                  
                  <CardHeader className="p-8 pb-0">
                    {pkg.is_popular && (
                      <span className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full bg-teal/10 text-teal text-[11px] font-black uppercase tracking-wider mb-4 w-fit">
                        <Sparkles className="w-3 h-3" />
                        Most Popular
                      </span>
                    )}
                    <CardTitle className="text-2xl font-black text-navy">{pkg.name}</CardTitle>
                    <p className="text-gray-500 text-[15px] mt-2 leading-relaxed">{pkg.description}</p>
                    <div className="mt-6 flex items-baseline gap-1">
                      <span className="text-4xl font-black text-navy">K{pkg.price_amount.toLocaleString()}</span>
                      <span className="text-gray-500 font-medium">{pkg.price_suffix}</span>
                    </div>
                  </CardHeader>

                  <CardContent className="p-8 flex-1 flex flex-col">
                    <div className="space-y-4 mb-10 flex-1">
                      {pkg.features?.map((feature, i) => (
                        <div key={i} className="flex items-start gap-3 text-[15px] text-gray-600">
                          <div className="w-5 h-5 rounded-full bg-teal/10 flex items-center justify-center shrink-0 mt-0.5">
                            <Check className="w-3 h-3 text-teal" />
                          </div>
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>

                    <Button 
                      onClick={() => openMockupModal("pricing", { product: pkg.name })}
                      className={cn(
                        "w-full h-14 rounded-2xl font-bold text-[16px] transition-all group",
                        pkg.is_popular 
                          ? "bg-teal text-navy hover:bg-teal/90" 
                          : "bg-navy text-white hover:bg-navy/90"
                      )}
                    >
                      Start Your Project
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="mt-20 p-8 sm:p-12 rounded-[48px] bg-navy text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-teal/20 blur-[100px] -z-10" />
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="max-w-xl text-center md:text-left">
                <h3 className="text-3xl font-black mb-4 tracking-tight">Need a custom solution?</h3>
                <p className="text-gray-400 text-lg">
                  If none of our standard packages fit your needs, we&apos;d love to 
                  discuss a completely custom project tailored for you.
                </p>
              </div>
              <Button 
                onClick={() => openMockupModal("quote")}
                className="h-16 px-10 rounded-2xl bg-white text-navy hover:bg-teal hover:text-navy text-lg font-bold transition-all"
              >
                Request Custom Quote
              </Button>
            </div>
          </div>
        </div>
      </main>

      <Footer />
      <MockupModal />
    </div>
  )
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ")
}