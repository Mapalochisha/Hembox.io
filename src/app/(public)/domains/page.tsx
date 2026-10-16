"use client"

import { useState } from "react"
import type { FormEvent } from "react"
import Link from "next/link"
import {
  ArrowRight,
  CheckCircle2,
  Globe2,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { Navbar } from "@/components/landing/navbar"
import { Footer } from "@/components/landing/footer"

const extensions = [
  { tld: ".com", label: "For businesses", tone: "bg-teal/10 text-teal" },
  { tld: ".net", label: "For technology", tone: "bg-blue-50 text-blue-700" },
  { tld: ".org", label: "For communities", tone: "bg-violet-50 text-violet-700" },
  { tld: ".co", label: "For modern brands", tone: "bg-orange-50 text-orange-700" },
  { tld: ".online", label: "Build your presence", tone: "bg-rose-50 text-rose-700" },
  { tld: ".site", label: "Make it yours", tone: "bg-slate-100 text-slate-700" },
]

const benefits = [
  {
    icon: ShieldCheck,
    title: "Clear pricing",
    description: "We confirm registration and renewal costs before you commit.",
  },
  {
    icon: RefreshCw,
    title: "Renewal reminders",
    description: "Know when your domain is due for renewal, with no surprise claims.",
  },
  {
    icon: LockKeyhole,
    title: "Your domain, your control",
    description: "We’re building a secure place to track your domain and its status.",
  },
]

function normaliseDomain(value: string) {
  return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]
}

function isValidDomain(value: string) {
  if (value.length > 253 || !value.includes(".")) return false
  const labels = value.split(".")
  return labels.length >= 2 && labels.every((label) =>
    label.length > 0 &&
    label.length <= 63 &&
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
  )
}

export default function DomainsPage() {
  const [domain, setDomain] = useState("")
  const [contact, setContact] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const selectedDomain = normaliseDomain(domain)

  function chooseExtension(extension: string) {
    const base = selectedDomain.split(".")[0] || ""
    setDomain(base ? `${base}${extension}` : `yourbrand${extension}`)
    setError("")
    setSuccess(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setSuccess(false)

    if (!isValidDomain(selectedDomain)) {
      setError("Enter a complete domain, such as yourbusiness.com.")
      return
    }

    if (!contact.trim()) {
      setError("Enter an email address or WhatsApp number so we can reply.")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "contact",
          contact: contact.trim(),
          name: name.trim(),
          source: "domain-storefront",
          message: `Domain availability request: ${selectedDomain}\n\nPlease check availability with the registrar and confirm registration price, renewal price, and next steps before any payment is requested.`,
        }),
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "We couldn't send your request. Please try again.")
      }

      setSuccess(true)
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "We couldn't send your request. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-white text-navy">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[620px] bg-[radial-gradient(ellipse_at_top,rgba(45,212,191,0.15),transparent_65%)]" />
      <Navbar />

      <main className="relative pt-32 sm:pt-36">
        <section className="mx-auto max-w-[1120px] px-5 pb-16 sm:px-8 sm:pb-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-teal/20 bg-white/80 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-navy shadow-sm">
              <Sparkles className="h-4 w-4 text-teal" />
              Domains by HEMBOX.io
            </div>
            <h1 className="text-balance text-4xl font-black leading-[1.06] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
              Your next big idea
              <span className="mt-2 block text-teal">needs a name.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              Find a home for your brand. Tell us the domain you want and we’ll check availability and confirm registration and renewal pricing before you commit.
            </p>
          </div>

          <div className="mx-auto mt-10 max-w-3xl rounded-[28px] border border-slate-200 bg-white p-3 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.25)] sm:mt-12 sm:rounded-[32px] sm:p-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <label htmlFor="domain-name" className="block px-1 text-left text-sm font-bold text-slate-800">
                What domain would you like?
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-teal focus-within:bg-white focus-within:ring-4 focus-within:ring-teal/10">
                  <Search className="h-5 w-5 shrink-0 text-slate-400" />
                  <input
                    id="domain-name"
                    name="domain"
                    type="text"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={domain}
                    onChange={(event) => {
                      setDomain(event.target.value)
                      setError("")
                      setSuccess(false)
                    }}
                    placeholder="yourbusiness.com"
                    className="h-14 min-w-0 w-full bg-transparent text-base font-semibold outline-none placeholder:font-normal placeholder:text-slate-400"
                    aria-describedby="domain-note"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex h-14 shrink-0 items-center justify-center gap-2 rounded-2xl bg-navy px-6 text-sm font-bold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-navy/15 disabled:cursor-not-allowed disabled:opacity-60 sm:px-7"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isSubmitting ? "Sending request" : "Request availability"}
                  {!isSubmitting ? <ArrowRight className="h-4 w-4" /> : null}
                </button>
              </div>
              <p id="domain-note" className="px-1 text-left text-xs leading-5 text-slate-500">
                This sends an enquiry to HEMBOX.io; it does not reserve or register a domain.
              </p>

              <div className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="domain-contact" className="mb-1.5 block px-1 text-left text-xs font-semibold text-slate-600">
                    Email or WhatsApp number
                  </label>
                  <input
                    id="domain-contact"
                    name="contact"
                    value={contact}
                    onChange={(event) => setContact(event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-teal focus:ring-4 focus:ring-teal/10"
                  />
                </div>
                <div>
                  <label htmlFor="domain-name-contact" className="mb-1.5 block px-1 text-left text-xs font-semibold text-slate-600">
                    Your name <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <input
                    id="domain-name-contact"
                    name="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="How should we address you?"
                    autoComplete="name"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-teal focus:ring-4 focus:ring-teal/10"
                  />
                </div>
              </div>

              {error ? (
                <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm text-red-700">{error}</p>
              ) : null}
              {success ? (
                <div role="status" className="flex items-start gap-3 rounded-xl border border-teal/30 bg-teal/10 px-4 py-3 text-left text-sm text-slate-800">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal" />
                  <span><strong>Request sent.</strong> We’ve received your enquiry for {selectedDomain}. The domain is not registered or reserved yet; we’ll confirm availability and pricing before you decide.</span>
                </div>
              ) : null}
            </form>
          </div>

          <div className="mx-auto mt-8 max-w-3xl">
            <p className="mb-3 text-center text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Popular domain endings</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {extensions.map((item) => (
                <button
                  type="button"
                  key={item.tld}
                  onClick={() => chooseExtension(item.tld)}
                  className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 p-4 text-left transition hover:-translate-y-0.5 hover:border-teal/50 hover:shadow-lg hover:shadow-slate-900/5"
                >
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-black ${item.tone}`}>{item.tld}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-navy">{item.tld}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{item.label}</span>
                  </span>
                  <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-teal" />
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-slate-100 bg-slate-50/80 py-16 sm:py-20">
          <div className="mx-auto max-w-[1120px] px-5 sm:px-8">
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-coral">Straightforward by design</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">No guesswork. No hidden surprises.</h2>
              <p className="mt-4 text-base leading-7 text-slate-600">Domain pricing and registration are being connected to our provider. We’ll confirm the real details before asking you to pay.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {benefits.map(({ icon: Icon, title, description }) => (
                <div key={title} className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal/10 text-teal"><Icon className="h-6 w-6" /></div>
                  <h3 className="mt-5 text-lg font-extrabold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-20">
          <div className="flex flex-col items-start justify-between gap-8 rounded-[28px] bg-navy p-7 text-white sm:rounded-[36px] sm:p-10 md:flex-row md:items-center">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal">More than a domain</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Need a website to go with it?</h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">Start with your domain, then build a website that gives your business a home online. Domain purchase and website development remain separate choices.</p>
            </div>
            <Link href="/pricing" className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl bg-teal px-5 text-sm font-extrabold text-navy transition hover:bg-teal/90">
              Explore website services <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <p className="mx-auto mt-6 flex max-w-3xl items-start justify-center gap-2 text-center text-xs leading-5 text-slate-500">
            <Globe2 className="mt-0.5 h-4 w-4 shrink-0" />
            Domain availability, final prices, supported extensions, and registration terms must be confirmed before checkout. No registration or payment is performed on this page yet.
          </p>
        </section>
      </main>

      <Footer />
    </div>
  )
}
