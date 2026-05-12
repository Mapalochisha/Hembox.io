import { Navbar } from "@/components/landing/navbar"
import { HeroSection } from "@/components/landing/hero-section"
import { ServicesSection } from "@/components/landing/services-section"
import { ProcessSection } from "@/components/landing/process-section"
import { PortfolioSection } from "@/components/landing/portfolio-section"
import { ContactCTA } from "@/components/landing/contact-cta"
import { Footer } from "@/components/landing/footer"
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

      <Footer />

      <MockupModal />
    </div>
  )
}
