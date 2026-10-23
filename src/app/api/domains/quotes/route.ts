import { NextResponse } from "next/server"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { getDomainProvider } from "@/lib/domains/provider"
import { parseDomainSearchRequest } from "@/lib/domains/validation"
import {
  DomainQuotePreparationError,
  prepareLiveDomainQuote,
  validateDomainQuotePricing,
  type DomainQuoteCatalogRecord,
} from "@/lib/domains/quote-service"
import { isDomainQuoteUsable, type DomainQuoteSnapshot } from "@/lib/domains/quotes"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const requestSchema = z.object({
  domainName: z.string().trim().toLowerCase().min(3).max(253),
  idempotencyKey: z.string().trim().min(8).max(120).regex(/^[A-Za-z0-9._:-]+$/),
}).strict()

type SavedQuoteRow = {
  id: string
  order_id: string
  domain_name: string
  currency: "ZMW"
  registration_price_minor: number
  renewal_price_minor: number
  term_years: number
  total_due_minor: number
  pricing_source: string
  pricing_captured_at: string
  created_at: string
  expires_at: string
  provider_id: string | null
  availability_checked_at: string | null
  wholesale_currency: string | null
  registration_wholesale_minor: number | null
  renewal_wholesale_minor: number | null
  fx_rate_micros: number | null
  margin_basis_points: number | null
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  })
}

function quoteSnapshot(row: SavedQuoteRow): DomainQuoteSnapshot {
  return {
    domainName: row.domain_name,
    currency: "ZMW",
    registrationPriceMinor: row.registration_price_minor,
    renewalPriceMinor: row.renewal_price_minor,
    termYears: row.term_years,
    totalDueMinor: row.total_due_minor,
    pricingSource: row.pricing_source,
    pricingCapturedAt: row.pricing_captured_at,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }
}

function quoteResponse(row: SavedQuoteRow, orderStatus: string, now = Date.now()) {
  const snapshot = quoteSnapshot(row)
  return {
    order: { id: row.order_id, status: orderStatus },
    quote: {
      id: row.id,
      domainName: snapshot.domainName,
      currency: snapshot.currency,
      registrationPriceMinor: snapshot.registrationPriceMinor,
      renewalPriceMinor: snapshot.renewalPriceMinor,
      termYears: snapshot.termYears,
      totalDueMinor: snapshot.totalDueMinor,
      createdAt: snapshot.createdAt,
      expiresAt: snapshot.expiresAt,
      usable: isDomainQuoteUsable(snapshot, now),
    },
    availability: row.provider_id && row.availability_checked_at
      ? { provider: row.provider_id, checkedAt: row.availability_checked_at, status: "available_at_check" }
      : { provider: null, checkedAt: null, status: "not_verified" },
    checkoutEnabled: false,
    registrationEnabled: false,
    message: "This quote is saved for review. Payment and registration are not enabled yet.",
  }
}

async function getSavedQuote(db: SupabaseClient, orderId: string) {
  const { data, error } = await db
    .from("domain_order_quotes")
    .select("id,order_id,domain_name,currency,registration_price_minor,renewal_price_minor,term_years,total_due_minor,pricing_source,pricing_captured_at,created_at,expires_at,provider_id,availability_checked_at,wholesale_currency,registration_wholesale_minor,renewal_wholesale_minor,fx_rate_micros,margin_basis_points")
    .eq("order_id", orderId)
    .order("sequence", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data as SavedQuoteRow | null
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return json({ error: "Provide a valid fully-qualified domain name and an idempotency key." }, 400)
  }

  const domainRequest = parseDomainSearchRequest({ domains: [parsed.data.domainName] })
  if (!domainRequest.success) {
    return json({ error: "Enter a valid fully-qualified domain name." }, 400)
  }
  const domainName = domainRequest.data.domains[0]

  try {
    const authClient = createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) return json({ error: "Sign in to request a domain quote." }, 401)

    const scopedIdempotencyKey = "domain-quote:" + user.id + ":" + parsed.data.idempotencyKey
    const db = createServiceClient() as unknown as SupabaseClient

    // Replays return the original immutable snapshot without another provider call.
    const { data: existingOrder, error: existingOrderError } = await db
      .from("domain_orders")
      .select("id,customer_id,domain_name,status")
      .eq("idempotency_key", scopedIdempotencyKey)
      .maybeSingle()
    if (existingOrderError) throw existingOrderError

    if (existingOrder) {
      if (existingOrder.customer_id !== user.id || existingOrder.domain_name !== domainName) {
        return json({ error: "This idempotency key has already been used for another request.", code: "idempotency_key_reused" }, 409)
      }
      const savedQuote = await getSavedQuote(db, existingOrder.id)
      if (!savedQuote) {
        return json({ error: "The saved quote could not be recovered. Please contact support before retrying.", code: "quote_reconciliation_required" }, 503)
      }
      return json({ ...quoteResponse(savedQuote, existingOrder.status), idempotentReplay: true })
    }

    let provider
    try {
      provider = getDomainProvider()
    } catch {
      return json({ error: "Live domain quoting is not configured yet. Please use the domain enquiry form.", code: "live_provider_unavailable" }, 503)
    }
    if (provider.environment !== "live" || !provider.capabilities.availabilitySearch) {
      return json({ error: "Live domain quoting is disabled in this environment. Please use the domain enquiry form.", code: "live_provider_required" }, 503)
    }

    const tld = "." + domainName.split(".").at(-1)
    const { data: catalogData, error: catalogError } = await db
      .from("domain_tld_catalog")
      .select("tld,enabled,provider_id,wholesale_currency,registration_wholesale_minor,renewal_wholesale_minor,retail_currency,registration_retail_minor,renewal_retail_minor,wholesale_fx_rate_micros,margin_basis_points,pricing_source,price_updated_at")
      .eq("tld", tld)
      .maybeSingle()
    if (catalogError) throw catalogError

    let pricing
    try {
      pricing = validateDomainQuotePricing({
        domainName,
        catalog: catalogData as DomainQuoteCatalogRecord | null,
        provider,
      })
    } catch (error) {
      if (error instanceof DomainQuotePreparationError) {
        return json({ error: error.message, code: error.code }, error.status)
      }
      throw error
    }

    let availabilityResults
    try {
      availabilityResults = await provider.checkAvailability([domainName])
    } catch {
      return json({ error: "The registrar could not confirm domain availability.", code: "availability_unconfirmed" }, 503)
    }

    const matchingResult = Array.isArray(availabilityResults)
      ? availabilityResults.find((result) => result && typeof result.domain === "string" && result.domain.trim().toLowerCase() === domainName)
      : undefined

    let prepared
    try {
      prepared = prepareLiveDomainQuote({ pricing, availabilityResult: matchingResult })
    } catch (error) {
      if (error instanceof DomainQuotePreparationError) {
        return json({ error: error.message, code: error.code }, error.status)
      }
      throw error
    }

    const { data: rpcData, error: rpcError } = await db.rpc("create_domain_quote_order", {
      p_customer_id: user.id,
      p_customer_email: user.email ?? null,
      p_customer_contact: user.email ?? user.phone ?? null,
      p_domain_name: prepared.quote.domainName,
      p_provider_id: prepared.providerId,
      p_availability_checked_at: prepared.availabilityCheckedAt,
      p_idempotency_key: scopedIdempotencyKey,
      p_registration_price_minor: prepared.quote.registrationPriceMinor,
      p_renewal_price_minor: prepared.quote.renewalPriceMinor,
      p_term_years: prepared.quote.termYears,
      p_total_due_minor: prepared.quote.totalDueMinor,
      p_wholesale_currency: prepared.pricingBasis.wholesaleCurrency,
      p_registration_wholesale_minor: prepared.pricingBasis.registrationWholesaleMinor,
      p_renewal_wholesale_minor: prepared.pricingBasis.renewalWholesaleMinor,
      p_fx_rate_micros: prepared.pricingBasis.fxRateMicros,
      p_margin_basis_points: prepared.pricingBasis.marginBasisPoints,
      p_pricing_source: prepared.quote.pricingSource,
      p_pricing_captured_at: prepared.quote.pricingCapturedAt,
      p_created_at: prepared.quote.createdAt,
      p_expires_at: prepared.quote.expiresAt,
    })
    if (rpcError) {
      if (rpcError.code === "22023") {
        return json({ error: "This quote request conflicts with an existing idempotency key or no longer has valid provider evidence.", code: "quote_conflict" }, 409)
      }
      console.error("Atomic domain quote persistence failed:", { code: rpcError.code ?? "unknown" })
      return json({ error: "The quote could not be saved. No payment or registration was attempted.", code: "quote_persistence_failed" }, 503)
    }

    const rpcRow = Array.isArray(rpcData) ? rpcData[0] : rpcData
    if (!rpcRow || typeof rpcRow !== "object" || !("order_id" in rpcRow)) {
      return json({ error: "The saved quote result could not be confirmed. Contact support before retrying.", code: "quote_reconciliation_required" }, 503)
    }

    const persistedOrderId = String((rpcRow as { order_id: unknown }).order_id)
    const persistedQuote = await getSavedQuote(db, persistedOrderId)
    if (!persistedQuote) {
      return json({ error: "The quote was saved but its snapshot could not be read back. Contact support before retrying.", code: "quote_reconciliation_required" }, 503)
    }

    const created = (rpcRow as { created?: unknown }).created === true
    return json({
      ...quoteResponse(persistedQuote, "quoted"),
      idempotentReplay: !created,
    }, created ? 201 : 200)
  } catch (error) {
    console.error("Domain quote request failed:", error instanceof Error ? error.name : "unknown_error")
    return json({ error: "Domain quoting is temporarily unavailable. Please use the enquiry form.", code: "quote_service_unavailable" }, 503)
  }
}
