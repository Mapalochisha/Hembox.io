"use client"

import { useState } from "react"
import type { FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BRAND_NAME } from "@/lib/brand"
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
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

type SearchResult = {
  domain: string
  isExact: boolean
  supported: boolean
  availability: "available" | "unavailable" | "unknown" | "unsupported"
  registrationPriceMinor: number | null
  renewalPriceMinor: number | null
  currency: "ZMW"
  pricingCurrent: boolean
  canRegister: boolean
  checkedAt: string | null
  message?: string
}

const benefits = [
  {
    icon: ShieldCheck,
    title: "Clear pricing",
    description: "See registration and renewal prices before you commit.",
  },
  {
    icon: RefreshCw,
    title: "Renewal clarity",
    description: "Know the ongoing cost of keeping your domain active.",
  },
  {
    icon: LockKeyhole,
    title: "Your domain, your control",
    description: "Manage DNS, renewals, and domain settings through your HEMBOX client portal.",
  },
]

function normaliseSearch(value: string) {
  return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]
}

function formatPrice(minor: number | null) {
  if (minor === null) return "Price unavailable"
  return new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency: "ZMW",
    maximumFractionDigits: 2,
  }).format(minor / 100)
}

function availabilityLabel(result: SearchResult) {
  if (!result.supported || result.availability === "unsupported") return "Not supported by HEMBOX"
  if (result.availability === "available") return "Available"
  if (result.availability === "unavailable") return "Already registered"
  return "Status unconfirmed"
}

function availabilityTone(result: SearchResult) {
  if (!result.supported || result.availability === "unsupported") return "bg-slate-100 text-slate-700"
  if (result.availability === "available") return "bg-teal/10 text-teal"
  if (result.availability === "unavailable") return "bg-slate-100 text-slate-600"
  return "bg-amber-50 text-amber-800"
}

export default function DomainsPage() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [error, setError] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])

  const exactResult = results.find((result) => result.isExact)
  const alternatives = results.filter((result) => !result.isExact)

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setResults([])
    setHasSearched(false)

    const searchQuery = normaliseSearch(query)
    if (!searchQuery) {
      setError("Enter a domain name to search.")
      return
    }

    setIsSearching(true)
    try {
      const response = await fetch("/api/domains/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Could not search for domains.")
      setResults(Array.isArray(payload.results) ? payload.results : [])
      setHasSearched(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Domain search failed. Please try again.")
    } finally {
      setIsSearching(false)
    }
  }

  function handleClaimDomain(domain: string) {
    const targetUrl = `/portal/domains?claim=${encodeURIComponent(domain)}`
    router.push(`/register?next=${encodeURIComponent(targetUrl)}`)
  }

  function ResultCard({ result }: { result: SearchResult }) {
    const available = result.availability === "available" && result.supported
    return (
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${availabilityTone(result)}`}>
                {available ? <CheckCircle2 className="h-3.5 w-3.5" /> : result.availability === "unknown" ? <CircleAlert className="h-3.5 w-3.5" /> : null}
                {availabilityLabel(result)}
              </span>
              {result.isExact && <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Exact match</span>}
            </div>
            <h3 className="mt-2 break-all text-xl font-black tracking-tight text-navy sm:text-2xl">{result.domain}</h3>
            {result.availability === "unsupported" ? (
              <p className="mt-1 text-sm text-slate-500">We cannot register this extension at the moment.</p>
            ) : result.availability === "unavailable" ? (
              <p className="mt-1 text-sm text-slate-500">This name is already registered. Consider one of the alternatives.</p>
            ) : result.availability === "unknown" ? (
              <p className="mt-1 text-sm text-slate-500">{result.message || "The registrar could not confirm availability."}</p>
            ) : (
              <p className="mt-1 text-sm text-slate-500">Availability confirmed by our domain registrar.</p>
            )}
          </div>

          {result.supported && (
            <div className="grid shrink-0 grid-cols-2 gap-5 sm:min-w-[260px]">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Registration</p>
                <p className="mt-1 text-base font-extrabold text-navy">{formatPrice(result.registrationPriceMinor)}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Renewal / year</p>
                <p className="mt-1 text-base font-extrabold text-navy">{formatPrice(result.renewalPriceMinor)}</p>
              </div>
            </div>
          )}
        </div>

        {result.canRegister ? (
          <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-slate-500">Final availability and price are rechecked before registration.</p>
            <button
              type="button"
              onClick={() => handleClaimDomain(result.domain)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-teal px-5 text-sm font-extrabold text-navy transition hover:bg-teal/90"
            >
              Register this domain <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : available ? (
          <p className="mt-4 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
            {result.pricingCurrent
              ? "Registration is not enabled in the current environment."
              : "Registration is unavailable until current pricing has been verified."}
          </p>
        ) : null}
      </article>
    )
  }

  return (
    <div className="min-h-screen bg-white text-navy selection:bg-teal selection:text-white">
      <Navbar />

      <main className="relative overflow-hidden pt-24">
        <section className="relative px-5 pb-16 pt-12 sm:px-8 sm:pb-20 sm:pt-16">
          <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 select-none">
            <div className="h-[380px] w-[900px] rounded-full bg-gradient-to-tr from-teal/15 via-blue-50/30 to-transparent blur-[110px]" />
          </div>

          <div className="relative mx-auto max-w-[850px] text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal/20 bg-teal/5 px-4 py-1.5 text-xs font-bold text-teal">
              <Sparkles className="h-3.5 w-3.5" />
              Search across supported extensions
            </div>

            <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-6xl sm:leading-[1.1]">
              Find a domain that <span className="text-teal">fits your name.</span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              Search once to discover available domain extensions. Enter a name like <strong className="font-semibold text-navy">yourbrand</strong> or a specific domain like <strong className="font-semibold text-navy">yourbrand.com</strong>.
            </p>

            <form onSubmit={handleSearch} className="mx-auto mt-8 max-w-2xl text-left">
              <div className="relative flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/5 sm:flex-row sm:items-center sm:gap-0 sm:rounded-full">
                <div className="flex flex-1 items-center px-4">
                  <Search className="h-5 w-5 shrink-0 text-slate-400" />
                  <input
                    type="text"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value)
                      setError("")
                      setResults([])
                      setHasSearched(false)
                    }}
                    placeholder="Search a name or full domain"
                    className="h-12 w-full bg-transparent px-3 text-sm font-medium text-navy placeholder:text-slate-400 focus:outline-none sm:text-base"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSearching}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-navy px-6 text-sm font-bold text-white transition hover:bg-navy/90 disabled:opacity-70 sm:rounded-full"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-teal" />
                      Searching...
                    </>
                  ) : (
                    <>
                      Search domains <ArrowRight className="h-4 w-4 text-teal" />
                    </>
                  )}
                </button>
              </div>

              {error && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
                  <CircleAlert className="h-4 w-4 shrink-0 text-rose-600" />
                  {error}
                </div>
              )}
            </form>

            {hasSearched && (
              <div className="mx-auto mt-9 max-w-3xl text-left">
                {results.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
                    No supported extensions are currently available to check.
                  </div>
                ) : (
                  <>
                    {exactResult && (
                      <div>
                        <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-slate-500">Your requested domain</h2>
                        <ResultCard result={exactResult} />
                      </div>
                    )}
                    {alternatives.length > 0 && (
                      <div className={exactResult ? "mt-8" : ""}>
                        <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-slate-500">
                          {exactResult ? "Other extensions to consider" : "Matching domain extensions"}
                        </h2>
                        <div className="space-y-3">
                          {alternatives.map((result) => <ResultCard key={result.domain} result={result} />)}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="border-y border-slate-100 bg-slate-50/80 py-14 sm:py-16">
          <div className="mx-auto max-w-[1120px] px-5 sm:px-8">
            <div className="mx-auto mb-9 max-w-2xl text-center">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-coral">Straightforward by design</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">No guesswork. No hidden surprises.</h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Availability is checked with our registrar. Registration and renewal prices come from the HEMBOX domain pricing catalogue.
              </p>
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

        <section className="mx-auto max-w-[1120px] px-5 py-14 sm:px-8 sm:py-16">
          <div className="flex flex-col items-start justify-between gap-8 rounded-[28px] bg-navy p-7 text-white sm:rounded-[36px] sm:p-10 md:flex-row md:items-center">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal">More than a domain</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Need a website to go with it?</h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
                Start with your domain, then build a website that gives your business a home online. Domain purchase and website development remain separate choices.
              </p>
            </div>
            <Link href="/pricing" className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl bg-teal px-5 text-sm font-extrabold text-navy transition hover:bg-teal/90">
              Explore website services <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <p className="mx-auto mt-6 flex max-w-3xl items-start justify-center gap-2 text-center text-xs leading-5 text-slate-500">
            <Globe2 className="mt-0.5 h-4 w-4 shrink-0" />
            Domain registration and renewal services are backed by {BRAND_NAME} support.
          </p>
        </section>
      </main>

      <Footer />
    </div>
  )
}
