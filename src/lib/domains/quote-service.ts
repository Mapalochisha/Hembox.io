import {
  calculateRetailPrice,
  isPricingSnapshotFresh,
} from "./pricing.ts"
import { createDomainQuoteSnapshot, type DomainQuoteSnapshot } from "./quotes.ts"
import type { DomainAvailabilityResult, DomainProvider } from "./types.ts"

const MAX_PRICING_AGE_MS = 24 * 60 * 60 * 1000
const MAX_AVAILABILITY_AGE_MS = 60 * 1000

export type DomainQuoteCatalogRecord = {
  tld: string
  enabled: boolean
  provider_id: string
  wholesale_currency: string
  registration_wholesale_minor: number | null
  renewal_wholesale_minor: number | null
  retail_currency: string
  registration_retail_minor: number | null
  renewal_retail_minor: number | null
  wholesale_fx_rate_micros: number | null
  margin_basis_points: number | null
  pricing_source: string | null
  price_updated_at: string | null
}

export class DomainQuotePreparationError extends Error {
  readonly status: 409 | 503
  readonly code: string

  constructor(code: string, message: string, status: 409 | 503) {
    super(message)
    this.name = "DomainQuotePreparationError"
    this.code = code
    this.status = status
  }
}

export type ValidatedDomainQuotePricing = {
  domainName: string
  providerId: string
  registrationPriceMinor: number
  renewalPriceMinor: number
  pricingSource: string
  pricingCapturedAt: string
  pricingBasis: {
    wholesaleCurrency: string
    registrationWholesaleMinor: number
    renewalWholesaleMinor: number
    fxRateMicros: number
    marginBasisPoints: number
  }
}

function fail(code: string, message: string, status: 409 | 503): never {
  throw new DomainQuotePreparationError(code, message, status)
}

function safeInteger(value: unknown, minimum: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum
}

function normaliseDomainName(value: string): string {
  const domainName = value.trim().toLowerCase()
  if (
    domainName.length < 3 ||
    domainName.length > 253 ||
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(domainName)
  ) {
    fail("invalid_domain", "Enter a valid fully-qualified domain name.", 409)
  }
  return domainName
}

/**
 * Validate pricing before calling a registrar. Recompute retail amounts from
 * the stored wholesale, FX, and margin inputs instead of trusting retail
 * fields in isolation.
 */
export function validateDomainQuotePricing(input: {
  domainName: string
  catalog: DomainQuoteCatalogRecord | null
  provider: Pick<DomainProvider, "id" | "environment" | "capabilities">
  now?: number
}): ValidatedDomainQuotePricing {
  const domainName = normaliseDomainName(input.domainName)
  const now = input.now ?? Date.now()
  if (!Number.isFinite(now)) {
    fail("invalid_clock", "The quote service could not validate its clock.", 503)
  }
  if (input.provider.environment !== "live" || !input.provider.capabilities.availabilitySearch) {
    fail("live_provider_required", "Live domain quotes are not enabled in this environment.", 503)
  }

  const catalog = input.catalog
  if (!catalog || !catalog.enabled) {
    fail("price_unavailable", "Current pricing is not published for this domain extension. Please send an enquiry.", 409)
  }

  const expectedTld = "." + domainName.split(".").at(-1)
  if (catalog.tld !== expectedTld) {
    fail("catalog_tld_mismatch", "The saved pricing does not match this domain extension.", 503)
  }
  if (catalog.provider_id !== input.provider.id) {
    fail("provider_price_mismatch", "The saved pricing is not for the currently selected registrar.", 503)
  }
  if (catalog.retail_currency !== "ZMW" || !/^[A-Z]{3}$/.test(catalog.wholesale_currency)) {
    fail("invalid_price_currency", "The saved pricing currency is not valid.", 503)
  }
  if (
    !safeInteger(catalog.registration_wholesale_minor, 0) ||
    !safeInteger(catalog.renewal_wholesale_minor, 0) ||
    !safeInteger(catalog.registration_retail_minor, 1) ||
    !safeInteger(catalog.renewal_retail_minor, 1) ||
    !safeInteger(catalog.wholesale_fx_rate_micros, 1) ||
    !safeInteger(catalog.margin_basis_points, 0) ||
    catalog.margin_basis_points > 100000 ||
    typeof catalog.pricing_source !== "string" ||
    !catalog.pricing_source.trim() ||
    catalog.pricing_source.length > 160
  ) {
    fail("invalid_price_snapshot", "The saved pricing snapshot is incomplete or invalid.", 503)
  }
  if (!isPricingSnapshotFresh(catalog.price_updated_at, now, MAX_PRICING_AGE_MS)) {
    fail("price_stale", "The saved price has expired and must be verified again before a quote can be issued.", 409)
  }

  let registrationCalculation: ReturnType<typeof calculateRetailPrice>
  let renewalCalculation: ReturnType<typeof calculateRetailPrice>
  try {
    registrationCalculation = calculateRetailPrice({
      wholesaleMinor: catalog.registration_wholesale_minor,
      fxRateMicros: catalog.wholesale_fx_rate_micros,
      marginBasisPoints: catalog.margin_basis_points,
    })
    renewalCalculation = calculateRetailPrice({
      wholesaleMinor: catalog.renewal_wholesale_minor,
      fxRateMicros: catalog.wholesale_fx_rate_micros,
      marginBasisPoints: catalog.margin_basis_points,
    })
  } catch {
    fail("invalid_price_snapshot", "The saved pricing calculation is outside the supported range.", 503)
  }

  if (
    registrationCalculation.retailZmwMinor !== catalog.registration_retail_minor ||
    renewalCalculation.retailZmwMinor !== catalog.renewal_retail_minor
  ) {
    fail("price_snapshot_mismatch", "The saved retail prices do not match their recorded cost, FX, and margin inputs.", 503)
  }

  return {
    domainName,
    providerId: input.provider.id,
    registrationPriceMinor: catalog.registration_retail_minor,
    renewalPriceMinor: catalog.renewal_retail_minor,
    pricingSource: catalog.pricing_source.trim(),
    pricingCapturedAt: new Date(Date.parse(catalog.price_updated_at!)).toISOString(),
    pricingBasis: {
      wholesaleCurrency: catalog.wholesale_currency,
      registrationWholesaleMinor: catalog.registration_wholesale_minor,
      renewalWholesaleMinor: catalog.renewal_wholesale_minor,
      fxRateMicros: catalog.wholesale_fx_rate_micros,
      marginBasisPoints: catalog.margin_basis_points,
    },
  }
}

/**
 * Turn validated pricing plus fresh, matching registrar evidence into a
 * one-year quote. Multi-year quote terms stay disabled until per-term prices
 * are stored instead of multiplying a one-year price.
 */
export function prepareLiveDomainQuote(input: {
  pricing: ValidatedDomainQuotePricing
  availabilityResult: DomainAvailabilityResult | null | undefined
  now?: number
  validityMs?: number
}): {
  quote: DomainQuoteSnapshot
  providerId: string
  availabilityCheckedAt: string
  pricingBasis: ValidatedDomainQuotePricing["pricingBasis"]
} {
  const now = input.now ?? Date.now()
  if (!Number.isFinite(now)) {
    fail("invalid_clock", "The quote service could not validate its clock.", 503)
  }

  const result = input.availabilityResult
  if (!result) {
    fail("availability_unconfirmed", "The registrar did not return a result for this domain.", 503)
  }
  if (
    result.domain.trim().toLowerCase() !== input.pricing.domainName ||
    result.source !== input.pricing.providerId
  ) {
    fail("availability_response_mismatch", "The registrar response did not match the requested domain.", 503)
  }

  const checkedAtMs = Date.parse(result.checkedAt)
  if (
    !Number.isFinite(checkedAtMs) ||
    checkedAtMs > now ||
    now - checkedAtMs > MAX_AVAILABILITY_AGE_MS
  ) {
    fail("availability_stale", "The availability check is too old to issue a quote.", 503)
  }
  if (result.availability === "unavailable") {
    fail("domain_unavailable", "The registrar reports that this domain is unavailable.", 409)
  }
  if (result.availability !== "available") {
    fail("availability_unconfirmed", "The registrar could not confirm that this domain is available.", 503)
  }

  let quote: DomainQuoteSnapshot
  try {
    quote = createDomainQuoteSnapshot({
      domainName: input.pricing.domainName,
      currency: "ZMW",
      registrationPriceMinor: input.pricing.registrationPriceMinor,
      renewalPriceMinor: input.pricing.renewalPriceMinor,
      termYears: 1,
      pricingSource: input.pricing.pricingSource,
      pricingCapturedAt: input.pricing.pricingCapturedAt,
      now,
      validityMs: input.validityMs,
    })
  } catch {
    fail("quote_snapshot_invalid", "The price snapshot cannot support a valid quote.", 409)
  }

  return {
    quote,
    providerId: input.pricing.providerId,
    availabilityCheckedAt: new Date(checkedAtMs).toISOString(),
    pricingBasis: input.pricing.pricingBasis,
  }
}
