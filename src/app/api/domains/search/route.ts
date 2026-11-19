import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { getDomainProvider } from "@/lib/domains/provider"
import { isPricingSnapshotFresh } from "@/lib/domains/pricing"
import {
  buildDomainSearchCandidates,
  chunkDomainNames,
  parseDomainSearchQuery,
} from "@/lib/domains/validation"
import { checkRateLimit, SEARCH_RATE_LIMIT } from "@/lib/domains/rate-limit"
import type { DomainAvailabilityResult } from "@/lib/domains/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MAX_PRICE_AGE_MS = 24 * 60 * 60 * 1000
const PROVIDER_BATCH_SIZE = 10
const MAX_PARALLEL_BATCHES = 3

type CatalogRow = {
  tld: string
  retail_currency: string
  registration_retail_minor: number | null
  renewal_retail_minor: number | null
  price_updated_at: string | null
}

type SearchCatalogItem = {
  tld: string
  registrationPriceMinor: number | null
  renewalPriceMinor: number | null
  pricingCurrent: boolean
}

function unknownResult(domain: string, providerId: string, message: string): DomainAvailabilityResult {
  return {
    domain,
    availability: "unknown",
    registrationPrice: null,
    renewalPrice: null,
    checkedAt: new Date().toISOString(),
    source: providerId as DomainAvailabilityResult["source"],
    message,
  }
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "unknown"
  const rateLimit = checkRateLimit(ip, SEARCH_RATE_LIMIT.windowMs, SEARCH_RATE_LIMIT.maxRequests)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before trying again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000)) } },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 })
  }

  const parsed = parseDomainSearchQuery(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid domain name, either a name such as 'example' or a full domain such as 'example.com'." },
      { status: 400 },
    )
  }

  try {
    const supabase = createServiceClient()
    const db = supabase as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (column: string, value: boolean) => {
            order: (column: string, options: { ascending: boolean }) => Promise<{
              data: CatalogRow[] | null
              error: { message: string } | null
            }>
          }
        }
      }
    }

    const { data, error } = await db
      .from("domain_tld_catalog")
      .select("tld,retail_currency,registration_retail_minor,renewal_retail_minor,price_updated_at,enabled")
      .eq("enabled", true)
      .order("tld", { ascending: true })

    if (error) throw error

    const now = Date.now()
    const catalog: SearchCatalogItem[] = (data ?? []).map((row) => {
      const fresh = isPricingSnapshotFresh(row.price_updated_at, now, MAX_PRICE_AGE_MS)
      const hasPrices = row.registration_retail_minor !== null && row.renewal_retail_minor !== null
      const pricingCurrent = fresh && hasPrices && row.retail_currency === "ZMW"

      return {
        tld: row.tld,
        registrationPriceMinor: pricingCurrent ? row.registration_retail_minor : null,
        renewalPriceMinor: pricingCurrent ? row.renewal_retail_minor : null,
        pricingCurrent,
      }
    })

    const search = buildDomainSearchCandidates(parsed.data, catalog.map((item) => item.tld))
    const provider = getDomainProvider()
    const availabilityByDomain = new Map<string, DomainAvailabilityResult>()
    const batches = chunkDomainNames(search.candidates, PROVIDER_BATCH_SIZE)

    if (provider.capabilities.availabilitySearch) {
      // Small bounded concurrency keeps provider traffic controlled while
      // allowing a complete catalogue search to finish in a single request.
      for (let index = 0; index < batches.length; index += MAX_PARALLEL_BATCHES) {
        const group = batches.slice(index, index + MAX_PARALLEL_BATCHES)
        const groupResults = await Promise.all(group.map(async (batch) => {
          try {
            return await provider.checkAvailability(batch)
          } catch {
            return batch.map((domain) => unknownResult(
              domain,
              provider.id,
              "The registrar could not confirm this domain. Availability remains unconfirmed.",
            ))
          }
        }))

        for (const results of groupResults) {
          for (const result of results) {
            availabilityByDomain.set(result.domain.toLowerCase(), result)
          }
        }
      }
    } else {
      for (const domain of search.candidates) {
        availabilityByDomain.set(domain, unknownResult(
          domain,
          provider.id,
          "Live registrar availability checks are not enabled in this environment.",
        ))
      }
    }

    const catalogByTld = new Map(catalog.map((item) => [item.tld, item]))
    const results = []

    if (parsed.data.exactDomain && search.exactSupported === false) {
      results.push({
        domain: parsed.data.exactDomain,
        isExact: true,
        supported: false,
        availability: "unsupported" as const,
        registrationPriceMinor: null,
        renewalPriceMinor: null,
        currency: "ZMW" as const,
        pricingCurrent: false,
        canRegister: false,
        checkedAt: null,
        message: "HEMBOX does not currently support this extension. Here are alternatives we can check.",
      })
    }

    for (const domain of search.candidates) {
      const tld = domain.slice(parsed.data.baseName.length)
      const price = catalogByTld.get(tld)
      const availability = availabilityByDomain.get(domain.toLowerCase())
      const state = availability?.availability ?? "unknown"
      const pricingCurrent = price?.pricingCurrent === true
      const canRegister = state === "available" && pricingCurrent && provider.capabilities.registration

      results.push({
        domain,
        isExact: parsed.data.exactDomain === domain,
        supported: true,
        availability: state,
        registrationPriceMinor: price?.registrationPriceMinor ?? null,
        renewalPriceMinor: price?.renewalPriceMinor ?? null,
        currency: "ZMW" as const,
        pricingCurrent,
        canRegister,
        checkedAt: availability?.checkedAt ?? null,
        message: availability?.message ?? "The registrar did not return a conclusive result.",
      })
    }

    return NextResponse.json({
      query: parsed.data.query,
      provider: provider.id,
      environment: provider.environment,
      live: provider.environment === "live" && provider.capabilities.availabilitySearch,
      results,
    }, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    console.error("Domain search failed:", error)
    return NextResponse.json(
      { error: "Domain search is temporarily unavailable. Please try again shortly." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }
}
