"use client"

import { useAgency } from "@/components/providers/agency-provider"
import { Navbar } from "@/components/landing/navbar"
import { Footer } from "@/components/landing/footer"

export default function PrivacyPage() {
  const { privacy_policy, agency_name } = useAgency()

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="pt-32 pb-24">
        <div className="max-w-[800px] mx-auto px-6">
          <h1 className="text-4xl font-black text-navy mb-8">Privacy Policy</h1>
          <div className="prose prose-slate max-w-none">
            {privacy_policy ? (
              <div className="whitespace-pre-wrap text-gray-600 leading-relaxed">
                {privacy_policy}
              </div>
            ) : (
              <p className="text-gray-500 italic">Privacy policy for {agency_name} is being updated.</p>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
