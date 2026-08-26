"use client"

import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { openMockupModal } from "@/components/landing/mockup-modal"
import Link from "next/link"
import { ArrowRight, Play } from "lucide-react"

export function HeroSection() {
  const laptopRef = useRef<HTMLDivElement>(null)
  let ticking = false

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (window.innerWidth < 1024 || !laptopRef.current) return
      if (!ticking) {
        requestAnimationFrame(() => {
          const rect = laptopRef.current!.getBoundingClientRect()
          const cx = rect.left + rect.width / 2
          const cy = rect.top + rect.height / 2
          const dx = (e.clientX - cx) / rect.width
          const dy = (e.clientY - cy) / rect.height
          const rotX = 6 - dy * 4
          const rotY = -10 + dx * 6
          laptopRef.current!.style.transform = `perspective(2000px) rotateX(${rotX}deg) rotateY(${rotY}deg) rotateZ(1deg)`
          ticking = false
        })
        ticking = true
      }
    }

    const handleMouseLeave = () => {
      if (laptopRef.current && window.innerWidth >= 1024) {
        laptopRef.current.style.transform = "perspective(2000px) rotateX(6deg) rotateY(-10deg) rotateZ(1deg)"
      }
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseleave", handleMouseLeave)

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseleave", handleMouseLeave)
    }
  }, [])

  return (
    <section className="max-w-[1200px] mx-auto px-6 lg:px-8 pt-32 lg:pt-40 pb-20 lg:pb-28">
      <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-16 lg:gap-12 items-center">
        {/* Left Content */}
        <div className="relative">
          <h1 className="text-[44px] leading-[1.05] sm:text-[56px] lg:text-[68px] xl:text-[76px] font-[900] tracking-[-0.02em] text-navy">
            Your website
            <span className="block">shouldn't be</span>
            <span className="relative inline-block">
              boring.
              <svg className="absolute -bottom-2 left-0 w-full h-3 text-coral" viewBox="0 0 200 12" fill="none">
                <path d="M2 8c40-6 80-8 120-6 26 1 52 3 76 5" stroke="currentColor" strokeWidth="4" strokeLinecap="round" fill="none"/>
              </svg>
            </span>
          </h1>

          <p className="mt-6 text-[18px] sm:text-[20px] leading-relaxed text-gray-600 max-w-[520px]">
            We build fast, beautiful sites that <span className="text-navy font-medium">actually convert.</span> No templates. No bloat. Just results.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row gap-3">
            <Button
              onClick={openMockupModal}
              className="btn-shine group relative h-[52px] px-7 rounded-full bg-coral text-white font-semibold text-[15.5px] shadow-[0_8px_24px_rgba(255,90,95,0.3)] hover:shadow-[0_12px_32px_rgba(255,90,95,0.4)] hover:translate-y-[-1px] active:translate-y-[0px] transition-all flex items-center justify-center gap-2"
            >
              Get a Free Mockup
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
            </Button>
            <Link
              href="#work"
              className="h-[52px] px-6 rounded-full border border-gray-200 font-medium text-[15px] hover:border-gray-300 hover:bg-gray-50 transition flex items-center justify-center gap-2"
            >
              <span className="w-5 h-5 rounded-full border border-gray-300 grid place-items-center">
                <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
              </span>
              See our work
            </Link>
          </div>

          <div className="mt-10 flex items-center gap-5">
            <div className="flex -space-x-2.5">
              <div className="w-9 h-9 rounded-full bg-navy border-2 border-white grid place-items-center text-[11px] font-bold text-white">AC</div>
              <div className="w-9 h-9 rounded-full bg-teal border-2 border-white grid place-items-center text-[11px] font-bold text-navy">KM</div>
              <div className="w-9 h-9 rounded-full bg-coral border-2 border-white grid place-items-center text-[11px] font-bold text-white">JR</div>
              <div className="w-9 h-9 rounded-full bg-gray-100 border-2 border-white grid place-items-center text-[11px] font-bold text-gray-600">+50</div>
            </div>
            <div>
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map((i) => (
                  <svg key={i} width="16" height="16" fill="#FFB800" viewBox="0 0 20 20">
                    <path d="M10 1.5l2.4 4.9 5.4.8-3.9 3.8.9 5.4L10 14.1 5.2 16.4l.9-5.4-3.9-3.8 5.4-.8L10 1.5z"/>
                  </svg>
                ))}
              </div>
              <p className="text-[13px] text-gray-600 mt-0.5"><span className="font-semibold text-navy">4.9/5</span> from 50+ founders</p>
            </div>
          </div>
        </div>

        {/* Right - Laptop */}
        <div className="relative lg:h-[560px] flex items-center justify-center">
          {/* Floating elements */}
          <div className="absolute z-30 -top-4 left-12 w-11 h-11 animate-float-1 hidden lg:block">
            <svg viewBox="0 0 44 44" fill="none"><path d="M22 2c8 6 14 14 18 22-6 2-12 1-18-2-6-3-11-8-14 4-4 9-6 14-6z" fill="#2DD4BF" opacity="0.9"/><path d="M8 36c2-3 5-5 8-6" stroke="#0F172A" strokeWidth="2" strokeLinecap="round"/></svg>
          </div>
          <div className="absolute z-30 top-20 -right-6 w-10 h-10 animate-float-2 hidden lg:block">
            <svg viewBox="0 0 40 40" fill="none"><path d="M20 3c6 5 11 11 14 18-5 1-10 0-14-2-5-3-9-7-11-12 3-3 7-4 11-4z" fill="#FF5A5F" opacity="0.9"/></svg>
          </div>
          <div className="absolute z-30 bottom-16 -left-8 w-8 h-8 animate-float-3 hidden lg:block">
            <div className="w-full h-full rounded-full bg-teal/20 backdrop-blur grid place-items-center">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1l1.8 3.6L13 5.3l-3 2.9.7 4.1L7 10.2 3.3 12.3l.7-4.1-3-2.9 4.2-.7L7 1z" fill="#2DD4BF"/></svg>
            </div>
          </div>
          <div className="absolute z-30 -bottom-6 right-20 w-9 h-9 animate-float-4 hidden lg:block">
            <div className="w-full h-full rounded-xl bg-coral/15 backdrop-blur grid place-items-center rotate-12">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5l1.4 2.8 3.1.5-2.2 2.2.5 3.1L8 8.5 5.2 10l.5-3-2.2-2.2 3.1-.5L8 1.5z" fill="#FF5A5F"/></svg>
            </div>
          </div>

          {/* Sparkles */}
          <div className="absolute top-1/4 left-1/4 w-1.5 h-1.5 rounded-full bg-teal animate-twinkle" style={{animationDelay: "0.2s"}} />
          <div className="absolute top-1/3 right-1/4 w-1 h-1 rounded-full bg-coral animate-twinkle" style={{animationDelay: "0.8s"}} />
          <div className="absolute bottom-1/3 left-20 w-2 h-2 rounded-full bg-teal/60 animate-twinkle" style={{animationDelay: "1.4s"}} />

          <div className="relative w-full max-w-[640px]">
            <div className="relative mx-auto">
              {/* Screen */}
              <div
                ref={laptopRef}
                className="laptop-screen laptop-tilt relative w-full aspect-[16/10] rounded-[18px] bg-navy overflow-visible"
              >
                <div className="absolute inset-[10px] rounded-[10px] bg-white overflow-hidden">
                  {/* Browser chrome */}
                  <div className="h-[28px] bg-[#F8FAFC] border-b border-gray-100 flex items-center gap-1.5 px-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-coral" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#FFB800]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-teal" />
                    <div className="ml-3 h-4 flex-1 max-w-[220px] rounded-md bg-white border border-gray-200" />
                  </div>

                  {/* Fake website content */}
                  <div className="p-4 h-[calc(100%-28px)] bg-gradient-to-b from-white to-gray-50">
                    <div className="flex items-center justify-between mb-4">
                      <div className="h-2.5 w-20 rounded-full bg-navy" />
                      <div className="flex gap-1.5">
                        <div className="h-2 w-8 rounded-full bg-gray-200" />
                        <div className="h-2 w-8 rounded-full bg-gray-200" />
                        <div className="h-2 w-12 rounded-full bg-teal" />
                      </div>
                    </div>
                    <div className="grid grid-cols-12 gap-3 h-[72%]">
                      <div className="col-span-5 flex flex-col justify-center gap-2.5">
                        <div className="h-2.5 w-3/4 rounded-full bg-navy" />
                        <div className="h-2.5 w-5/6 rounded-full bg-navy/80" />
                        <div className="h-2 w-2/3 rounded-full bg-gray-300 mt-1" />
                        <div className="h-2 w-1/2 rounded-full bg-gray-300" />
                        <div className="mt-3 flex gap-2">
                          <div className="h-6 w-20 rounded-full bg-coral" />
                          <div className="h-6 w-16 rounded-full border border-gray-200" />
                        </div>
                      </div>
                      <div className="col-span-7 relative overflow-hidden rounded-2xl">
                        <div className="absolute inset-0 bg-gradient-to-br from-teal via-navy to-coral opacity-90" />
                        <div className="absolute inset-0" style={{backgroundImage: "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.2) 0, transparent 40%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.15) 0, transparent 40%)"}} />
                        <div className="absolute bottom-3 left-3 right-3 h-16 rounded-xl bg-white/15 backdrop-blur-md border border-white/20" />
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <div className="h-14 rounded-xl bg-[#F1F5F9] border border-gray-100" />
                      <div className="h-14 rounded-xl bg-[#F1F5F9] border border-gray-100" />
                      <div className="h-14 rounded-xl bg-gradient-to-br from-teal/20 to-coral/20 border border-teal/20" />
                    </div>
                  </div>
                </div>

                {/* Rocket */}
                <div className="animate-launch absolute left-1/2 bottom-[22%] z-20 pointer-events-none">
                  <div className="relative">
                    <div className="absolute -inset-6 bg-teal/30 rounded-full blur-2xl" />
                    <svg width="52" height="78" viewBox="0 0 52 78" fill="none" className="relative drop-shadow-[0_8px_20px_rgba(45,212,191,0.4)]">
                      <defs>
                        <linearGradient id="body" x1="26" y1="0" x2="26" y2="62">
                          <stop stopColor="#0F172A"/>
                          <stop offset="1" stopColor="#1e293b"/>
                        </linearGradient>
                        <linearGradient id="flameGrad" x1="26" y1="60" x2="26" y2="78">
                          <stop stopColor="#FF5A5F"/>
                          <stop offset="0.5" stopColor="#FF8A5F"/>
                          <stop offset="1" stopColor="#2DD4BF"/>
                        </linearGradient>
                      </defs>
                      <path d="M12 52l-7 14c12-1 14-5 14-10v-7l-7 3z" fill="#FF5A5F"/>
                      <path d="M40 52l7 14c-12-1-14-5-14-10v-7l7 3z" fill="#FF5A5F"/>
                      <path d="M26 2c7.5 7 14 17 14 30v22c0 7-6.3 12-14 12s-14-5-14-12V32C12 19 18.5 9 26 2z" fill="url(#body)"/>
                      <circle cx="26" cy="28" r="7.5" fill="#2DD4BF" stroke="white" strokeWidth="2.5"/>
                      <circle cx="24.5" cy="26.5" r="2.5" fill="white" fillOpacity="0.7"/>
                      <rect x="22" y="44" width="8" height="2" rx="1" fill="white" fillOpacity="0.2"/>
                      <rect x="22" y="49" width="8" height="2" rx="1" fill="white" fillOpacity="0.2"/>
                      <g className="animate-flame">
                        <path d="M19 60c0 5 2.2 9 7 14 4.8-5 7-9 7-14 0-3-1.2-5-3-6-1 2-2.5 3-4 6 0-3-1.5-4-3-6-1.8 1-4 3-4 6z" fill="url(#flameGrad)"/>
                        <path d="M22 62c0 2 1 4 4 6 3-2 4-4 4-6" fill="#FFD6A0" opacity="0.8"/>
                      </g>
                    </svg>
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
                      <span className="w-1 h-1 rounded-full bg-teal animate-ping" style={{animationDuration: "0.8s"}} />
                      <span className="w-1 h-1 rounded-full bg-coral animate-ping" style={{animationDuration: "1s", animationDelay: "0.2s"}} />
                      <span className="w-1 h-1 rounded-full bg-teal animate-ping" style={{animationDuration: "0.9s", animationDelay: "0.4s"}} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Laptop base */}
              <div className="laptop-base relative -mt-[2px] mx-auto w-[112%] h-[14px] rounded-b-[18px] left-[-6%]" />
              <div className="relative mx-auto w-[40%] h-[6px] -mt-[12px] rounded-b-xl bg-navy/80 blur-[1px]" />
              <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-[80%] h-16 bg-navy/15 blur-2xl rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}