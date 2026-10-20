/**
 * Provider-independent quote policy. This module deliberately does not fetch
 * provider data or persist orders; callers must only quote from a trusted,
 * fresh server-side price snapshot and persist the returned snapshot once.
 */

export type DomainQuoteInput = {
  domainName: string
  currency: "ZMW"
  registrationPriceMinor: number
  renewalPriceMinor: number
  termYears: number
  pricingSource: string
  pricingCapturedAt: string
  now?: number
  validityMs?: number
}

export type DomainQuoteSnapshot = Readonly<{
  domainName: string
  currency: "ZMW"
  registrationPriceMinor: number
  renewalPriceMinor: number
  termYears: number
  totalDueMinor: number
  pricingSource: string
  pricingCapturedAt: string
  createdAt: string
  expiresAt: string
}>

const DEFAULT_QUOTE_VALIDITY_MS = 15 * 60 * 1000
const MAX_QUOTE_VALIDITY_MS = 60 * 60 * 1000

function requirePositiveSafeInteger(name: string, value: number) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer.`)
  }
}

function requireTimestamp(name: string, value: string): number {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) throw new TypeError(`${name} must be a valid timestamp.`)
  return timestamp
}

/**
 * Capture all customer-visible price assumptions in one immutable value.
 * Renewal cost is shown separately and is not included in the first-year due.
 */
export function createDomainQuoteSnapshot(input: DomainQuoteInput): DomainQuoteSnapshot {
  const domainName = input.domainName.trim().toLowerCase()
  if (
    domainName.length < 3 ||
    domainName.length > 253 ||
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(domainName)
  ) {
    throw new TypeError("domainName must be a normalized domain name.")
  }

  requirePositiveSafeInteger("registrationPriceMinor", input.registrationPriceMinor)
  requirePositiveSafeInteger("renewalPriceMinor", input.renewalPriceMinor)
  requirePositiveSafeInteger("termYears", input.termYears)

  if (input.currency !== "ZMW") throw new TypeError("Only ZMW quotes are supported.")
  if (!input.pricingSource.trim() || input.pricingSource.length > 160) {
    throw new TypeError("pricingSource must identify the price source.")
  }

  const now = input.now ?? Date.now()
  if (!Number.isFinite(now)) throw new TypeError("now must be a valid timestamp.")
  const validityMs = input.validityMs ?? DEFAULT_QUOTE_VALIDITY_MS
  if (!Number.isSafeInteger(validityMs) || validityMs <= 0 || validityMs > MAX_QUOTE_VALIDITY_MS) {
    throw new RangeError("validityMs must be between 1 ms and 60 minutes.")
  }

  const pricingCapturedAt = requireTimestamp("pricingCapturedAt", input.pricingCapturedAt)
  if (pricingCapturedAt > now || now - pricingCapturedAt > 24 * 60 * 60 * 1000) {
    throw new RangeError("The underlying pricing snapshot is stale or from the future.")
  }

  const totalDue = input.registrationPriceMinor * input.termYears
  if (!Number.isSafeInteger(totalDue)) throw new RangeError("Quote total exceeds the safe integer range.")

  const createdAt = new Date(now).toISOString()
  const snapshot: DomainQuoteSnapshot = {
    domainName,
    currency: "ZMW",
    registrationPriceMinor: input.registrationPriceMinor,
    renewalPriceMinor: input.renewalPriceMinor,
    termYears: input.termYears,
    totalDueMinor: totalDue,
    pricingSource: input.pricingSource.trim(),
    pricingCapturedAt: new Date(pricingCapturedAt).toISOString(),
    createdAt,
    expiresAt: new Date(now + validityMs).toISOString(),
  }

  return Object.freeze(snapshot)
}

/** Expired quotes must be re-priced and re-confirmed, never silently renewed. */
export function isDomainQuoteUsable(
  quote: DomainQuoteSnapshot,
  now = Date.now(),
): boolean {
  if (!Number.isFinite(now)) return false
  const createdAt = Date.parse(quote.createdAt)
  const expiresAt = Date.parse(quote.expiresAt)
  const capturedAt = Date.parse(quote.pricingCapturedAt)
  return (
    Number.isFinite(createdAt) &&
    Number.isFinite(expiresAt) &&
    Number.isFinite(capturedAt) &&
    createdAt <= now &&
    now < expiresAt &&
    capturedAt <= createdAt &&
    createdAt - capturedAt <= 24 * 60 * 60 * 1000
  )
}
