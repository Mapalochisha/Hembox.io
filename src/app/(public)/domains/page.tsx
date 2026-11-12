"use client"

import { useEffect, useState } from "react"
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

const extensions = [
  { tld: ".com", label: "For businesses", tone: "bg-teal/10 text-teal" },
  { tld: ".net", label: "For technology", tone: "bg-blue-50 text-blue-700" },
  { tld: ".org", label: "For communities", tone: "bg-violet-50 text-violet-700" },
  { tld: ".co", label: "For modern brands", tone: "bg-orange-50 text-orange-700" },
  { tld: ".online", label: "Build your presence", tone: "bg-rose-50 text-rose-700" },
  { tld: ".site", label: "Make it yours", tone: "bg-slate-100 text-slate-700" },
]

type CatalogItem = {
  tld: string
  currency: "ZMW"
  pricingStatus: "current" | "price_unavailable"
  registrationPriceMinor: number | null
  renewalPriceMinor: number | null
  priceUpdatedAt: string | null
}

function formatCatalogPrice(minor: number | null) {
  if (minor === null) return "Price being confirmed"
  return new Intl.NumberFormat("en-ZM", { style: "currency", currency: "ZMW", maximumFractionDigits: 2 }).format(minor / 100)
}

const benefits = [
  {
    icon: ShieldCheck,
    title: "Clear pricing",
    description: "We confirm registration and renewal costs upfront before you pay.",
  },
  {
    icon: RefreshCw,
    title: "Automatic renewal reminders",
    description: "Know exactly when your domain is due for renewal with zero surprise price jumps.",
  },
  {
    icon: LockKeyhole,
    title: "Your domain, your ownership",
    description: "Manage DNS, renewals, and domain settings directly from your Hembox client portal.",
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

type SearchResultState = {
  domain: string
  availability: "available" | "unavailable" | "unknown"
  message?: string
  registrationPriceMinor?: number | null
  renewalPriceMinor?: number | null
}

export default function DomainsPage() {
  const router = useRouter()
  const [domain, setDomain] = useState("")
  const [error, setError] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [searchResult, setSearchResult] = useState<SearchResultState | null>(null)
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetch("/api/domains/catalog", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || "Catalogue unavailable")
        return result.catalog as CatalogItem[]
      })
      .then((items) => { if (active) setCatalog(items) })
      .catch(() => { if (active) setCatalog([]) })
      .finally(() => { if (active) setCatalogLoading(false) })
    return () => { active = false }
  }, [])

  const selectedDomain = normaliseDomain(domain)

  function chooseExtension(extension: string) {
    const base = selectedDomain.split(".")[0] || ""
    setDomain(base ? `${base}${extension}` : `yourbrand${extension}`)
    setError("")
    setSearchResult(null)
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setSearchResult(null)

    let domainToQuery = selectedDomain
    if (!domainToQuery.includes(".")) {
      domainToQuery = `${domainToQuery}.com`
      setDomain(domainToQuery)
    }

    if (!isValidDomain(domainToQuery)) {
      setError("Please enter a valid domain name (e.g. yourbusiness.com).")
      return
    }

    setIsSearching(true)
    try {
      const response = await fetch("/api/domains/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domains: [domainToQuery] }),
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || "Could not check availability. Please try again.")
      }

      const item = Array.isArray(result.results) ? result.results[0] : null
      if (!item) {
        throw new Error("No availability result returned from registrar.")
      }

      const ext = "." + domainToQuery.split(".").at(-1)
      const catalogEntry = catalog.find((c) => c.tld === ext)

      setSearchResult({
        domain: domainToQuery,
        availability: item.availability,
        message: item.message,
        registrationPriceMinor: catalogEntry?.registrationPriceMinor ?? null,
        renewalPriceMinor: catalogEntry?.renewalPriceMinor ?? null,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Availability check failed.")
    } finally {
      setIsSearching(false)
    }
  }

  function handleClaimDomain() {
    if (!searchResult || searchResult.availability !== "available") return
    const targetUrl = `/portal/domains?claim=${encodeURIComponent(searchResult.domain)}`
    router.push(`/register?next=${encodeURIComponent(targetUrl)}`)
  }

  return (
    <div className="min-h-screen bg-white text-navy selection:bg-teal selection:text-white">
      <Navbar />

      <main className="relative pt-24">
        <section className="relative overflow-hidden px-5 pb-20 pt-12 sm:px-8 sm:pb-24 sm:pt-16">
          <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 select-none">
            <div className="h-[400px] w-[900px] rounded-full bg-gradient-to-tr from-teal/15 via-blue-50/30 to-transparent blur-[110px]" />
          </div>

          <div className="relative mx-auto max-w-[840px] text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal/20 bg-teal/5 px-4 py-1.5 text-xs font-bold text-teal">
              <Sparkles className="h-3.5 w-3.5" />
              Live Registrar Search · Instant Verification
            </div>

            <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-6xl sm:leading-[1.1]">
              Find your ideal domain in <span className="text-teal">seconds</span>.
            </h1>

            <p className="mt-5 text-base leading-7 text-slate-600 sm:text-lg">
              Search real-time availability directly with our registrar. Claim your domain name, set up your account, and manage your brand all from the {BRAND_NAME} portal.
            </p>

            <form onSubmit={handleSearch} className="mx-auto mt-8 max-w-2xl text-left">
              <div className="relative flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/5 sm:flex-row sm:items-center sm:gap-0 sm:rounded-full">
                <div className="flex flex-1 items-center px-4">
                  <Search className="h-5 w-5 text-slate-400" />
                  <input
                    type="text"
                    value={domain}
                    onChange={(e) => {
                      setDomain(e.target.value)
                      setError("")
                      setSearchResult(null)
                    }}
                    placeholder="Search for a domain (e.g. yourbusiness.com)"
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
                      Checking...
                    </>
                  ) : (
                    <>
                      Check availability
                      <ArrowRight className="h-4 w-4 text-teal" />
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

            {searchResult && (
              <div className="mx-auto mt-8 max-w-2xl text-left animate-in fade-in slide-in-from-bottom-2 duration-300">
                {searchResult.availability === "available" ? (
                  <div className="rounded-3xl border border-teal/40 bg-teal/5 p-6 shadow-lg shadow-teal/5 sm:p-7">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-teal/20 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-teal">
                          <CheckCircle2 className="h-4 w-4 text-teal" />
                          Available to Register
                        </div>
                        <h3 className="mt-2 text-2xl font-black text-navy">{searchResult.domain}</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Verified live in NameSilo registry.
                        </p>
                      </div>

                      <div className="text-left sm:text-right">
                        <p className="text-xs uppercase tracking-wider text-slate-400">Annual Rate</p>
                        <p className="text-2xl font-black text-navy">
                          {formatCatalogPrice(searchResult.registrationPriceMinor ?? null)}
                        </p>
                        <p className="text-xs text-slate-500">per year</p>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-col gap-3 border-t border-teal/15 pt-5 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-slate-600">
                        Includes WHOIS privacy protection, free DNS management, and renewal protection.
                      </p>
                      <button
                        type="button"
                        onClick={handleClaimDomain}
                        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-teal px-5 text-sm font-black text-navy transition hover:bg-teal/90 shadow-md shadow-teal/20"
                      >
                        Claim domain & sign up
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : searchResult.availability === "unavailable" ? (
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 sm:p-7">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <span className="inline-flex items-center rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700">
                          Already Taken
                        </span>
                        <h3 className="mt-2 text-xl font-black text-navy">{searchResult.domain}</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          This domain is already registered. Try searching another name or extension below.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setDomain(""); setSearchResult(null); }}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        Try another name
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 sm:p-7">
                    <span className="inline-flex items-center rounded-full bg-amber-200 px-3 py-1 text-xs font-bold text-amber-900">
                      Status Unconfirmed
                    </span>
                    <h3 className="mt-2 text-xl font-black text-navy">{searchResult.domain}</h3>
                    <p className="mt-1 text-sm text-amber-900">
                      {searchResult.message || "The registrar could not return a conclusive status right now. Please try again in a moment."}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mx-auto mt-14 max-w-4xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal">TLD Catalogue</p>
                <h2 className="mt-1 text-2xl font-black">Supported domain extensions</h2>
              </div>
              <p className="text-xs text-slate-500">All prices in Zambian Kwacha (ZMW)</p>
            </div>

            {catalogLoading ? (
              <div className="flex items-center justify-center rounded-3xl border border-slate-200 bg-slate-50/50 p-8 text-sm text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-teal" />
                Loading supported extensions...
              </div>
            ) : catalog.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-slate-50/50 p-8 text-center text-sm text-slate-500">
                Live catalogue pricing is being refreshed.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {catalog.map((item) => (
                  <div key={item.tld} className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div>
                      <p className="text-lg font-black text-navy">{item.tld}</p>
                      <p className="text-xs text-slate-500">
                        {item.pricingStatus === "current" ? "Active retail rate" : "Price verification pending"}
                      </p>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-3 text-sm">
                      <div>
                        <p className="text-xs text-slate-400">Registration</p>
                        <p className="font-bold text-navy">{formatCatalogPrice(item.registrationPriceMinor)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Renewal / yr</p>
                        <p className="font-bold text-navy">{formatCatalogPrice(item.renewalPriceMinor)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mx-auto mt-10 max-w-3xl">
            <p className="mb-3 text-center text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Quick select an extension</p>
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
              <p className="mt-4 text-base leading-7 text-slate-600">
                Domain pricing and availability are verified directly with NameSilo. You see transparent pricing before you commit.
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

        <section className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-20">
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
            Registration and renewals are powered by verified provider pricing and backed by Hembox Tech support.
          </p>
        </section>
      </main>

      <Footer />
    </div>
  )
}
