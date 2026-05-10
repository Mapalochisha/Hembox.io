import { Navbar } from "@/components/landing/navbar"
import { HeroSection } from "@/components/landing/hero-section"
import { ServicesSection } from "@/components/landing/services-section"
import { ProcessSection } from "@/components/landing/process-section"
import { PortfolioSection } from "@/components/landing/portfolio-section"
import { ContactCTA } from "@/components/landing/contact-cta"
import { MockupModal } from "@/components/landing/mockup-modal"

export default function HomePage() {
  return (
    <div className="relative min-h-screen isolate overflow-hidden">
      <div className="absolute inset-0 -z-20 grid-bg [mask-image:radial-gradient(ellipse_at_center,black_60%,transparent_100%)]" />
      <div className="absolute -top-32 -right-20 w-[500px] h-[500px] -z-10 rounded-full bg-teal/20 blur-[120px]" />
      <div className="absolute top-1/2 -left-40 w-[400px] h-[400px] -z-10 rounded-full bg-coral/15 blur-[100px]" />

      <Navbar />

      <main className="relative">
        <HeroSection />
        <ServicesSection />
        <ProcessSection />
        <PortfolioSection />
        <ContactCTA />
      </main>

      <footer className="py-12 border-t border-black/5 relative">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-navy flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M4 4h7v7H4zM13 4h7v4h-7zM4 13h4v7H4zM13 11h7v9h-7z" fill="white" />
                </svg>
              </div>
              <span className="font-bold tracking-tight">Hembox.io</span>
            </div>
            <p className="text-gray-500 text-sm">© 2026 Hembox.io. All rights reserved.</p>
            <div className="flex gap-8">
              <a href="#" className="text-sm text-gray-500 hover:text-navy transition">Privacy</a>
              <a href="#" className="text-sm text-gray-500 hover:text-navy transition">Terms</a>
            </div>
          </div>
        </div>
      </footer>

      <MockupModal />
    </div>
  )
}