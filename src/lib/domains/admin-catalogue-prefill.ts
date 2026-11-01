/**
 * Builds the catalogue form prefill that the wholesale price reference hands to
 * the TLD catalogue page.
 *
 * The handoff is deliberately narrow. It carries only values the provider
 * actually returned, plus the provenance needed to justify them later. It never
 * enables a TLD, never supplies an FX rate, and never supplies a markup — those
 * remain owner decisions recorded through
 * docs/domain-pricing-inputs.md. Query parameters are user-editable, so
 * everything is validated again here rather than trusted because it arrived in
 * a link.
 */

export type CataloguePrefillEnvironment = "test" | "live"

export type CataloguePrefill = {
  tld: string
  providerId: string
  wholesaleCurrency: string
  registrationWholesaleMinor: string
  renewalWholesaleMinor: string
  pricingSource: string
}

export type CataloguePrefillResult = {
  prefill: CataloguePrefill
  environment: CataloguePrefillEnvironment
  fetchedAt: string
  warnings: string[]
}

/** USD cents. Above this a link is treated as malformed rather than real. */
export const MAX_WHOLESALE_MINOR = 100_000_000

const SUPPORTED_PROVIDER = "namesilo"
const SUPPORTED_CURRENCY = "USD"

function integerMinor(raw: string | null): number | null {
  if (raw === null) return null
  const trimmed = raw.trim()
  if (!/^\d{1,9}$/.test(trimmed)) return null
  const value = Number(trimmed)
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_WHOLESALE_MINOR) return null
  return value
}

function normaliseTld(raw: string | null): string | null {
  if (raw === null) return null
  const trimmed = raw.trim().toLowerCase().replace(/^\.+/, "")
  if (!trimmed) return null
  const labels = trimmed.split(".")
  // Second-level ccTLDs such as co.uk and co.zm are legitimate catalogue entries.
  if (labels.length > 3) return null
  if (!labels.every((label) => /^(?:[a-z]{2,24}|xn--[a-z0-9-]{2,50})$/.test(label))) return null
  return `.${trimmed}`
}

/**
 * Returns `null` when the reference cannot be trusted, so the form stays empty
 * instead of being filled with invented numbers.
 */
export function buildCataloguePrefill(params: URLSearchParams | null): CataloguePrefillResult | null {
  if (!params) return null

  const provider = (params.get("provider") ?? SUPPORTED_PROVIDER).trim().toLowerCase()
  if (provider !== SUPPORTED_PROVIDER) return null

  const currency = (params.get("currency") ?? SUPPORTED_CURRENCY).trim().toUpperCase()
  if (currency !== SUPPORTED_CURRENCY) return null

  const environment = params.get("environment")
  if (environment !== "test" && environment !== "live") return null

  const fetchedAtRaw = params.get("fetchedAt")
  if (!fetchedAtRaw) return null
  const fetchedAt = new Date(fetchedAtRaw)
  if (Number.isNaN(fetchedAt.getTime())) return null
  const fetchedAtIso = fetchedAt.toISOString()

  const tld = normaliseTld(params.get("tld"))
  if (!tld) return null

  const registration = integerMinor(params.get("registrationWholesaleMinor"))
  const renewal = integerMinor(params.get("renewalWholesaleMinor"))
  if (registration === null || renewal === null) return null

  const warnings = [
    "FX rate and markup were deliberately not filled in: they are owner decisions recorded in the pricing procedure.",
    "Nothing is saved or published by this handoff. The TLD stays disabled until you review and enable it.",
  ]

  if (environment === "test") {
    warnings.unshift(
      "These are OTE sandbox rates, not production costs. They are enough to rehearse the flow but not enough to approve a customer-facing price.",
    )
  }

  return {
    prefill: {
      tld,
      providerId: SUPPORTED_PROVIDER,
      wholesaleCurrency: SUPPORTED_CURRENCY,
      registrationWholesaleMinor: String(registration),
      renewalWholesaleMinor: String(renewal),
      pricingSource: `${SUPPORTED_PROVIDER}-standard:${environment}:${fetchedAtIso}`,
    },
    environment,
    fetchedAt: fetchedAtIso,
    warnings,
  }
}
