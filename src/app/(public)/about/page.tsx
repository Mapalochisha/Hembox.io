"use client"

import { useAgency } from "@/components/providers/agency-provider"
import { BRAND_NAME } from "@/lib/brand"
import { Navbar } from "@/components/landing/navbar"
import { Footer } from "@/components/landing/footer"

export default function AboutPage() {
  const { about_us_content } = useAgency()

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="pt-32 pb-24">
        <div className="max-w-[800px] mx-auto px-6">
          <h1 className="text-4xl font-black text-navy mb-8">About {BRAND_NAME}</h1>
          <div className="prose prose-slate max-w-none">
            {about_us_content ? (
              <div className="whitespace-pre-wrap text-gray-600 text-lg leading-relaxed">
                {about_us_content}
              </div>
            ) : (
              <p className="text-gray-500 italic">About content for {BRAND_NAME} is being updated.</p>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
