import { z } from "zod"

const domainSearchRequestSchema = z.object({
  domains: z.array(z.string().trim().toLowerCase().min(3).max(253)).min(1).max(10),
}).strict()

const domainSearchQuerySchema = z.object({
  query: z.string().trim().toLowerCase().min(1).max(253),
}).strict()

const DOMAIN_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

export type ParsedDomainSearchQuery = {
  query: string
  baseName: string
  exactDomain: string | null
}

export function isValidFullyQualifiedDomain(value: string): boolean {
  const labels = value.split(".")
  return labels.length >= 2 && labels.every((label) =>
    label.length >= 1 &&
    label.length <= 63 &&
    DOMAIN_LABEL_PATTERN.test(label)
  )
}

/**
 * Accept either a bare registrable name (example) or a fully-qualified
 * domain (example.co.zm). URLs, paths, whitespace and subdomain-like invalid
 * labels are rejected before any registrar request is made.
 */
export function parseDomainSearchQuery(value: unknown) {
  const parsed = domainSearchQuerySchema.safeParse(value)
  if (!parsed.success) return { success: false as const }

  const query = parsed.data.query
  if (/[\s/:?#]/.test(query) || query.startsWith(".") || query.endsWith(".")) {
    return { success: false as const }
  }

  if (query.includes(".")) {
    if (!isValidFullyQualifiedDomain(query)) return { success: false as const }
  } else if (query.length > 63 || !DOMAIN_LABEL_PATTERN.test(query)) {
    return { success: false as const }
  }

  return {
    success: true as const,
    data: {
      query,
      baseName: query.split(".")[0],
      exactDomain: query.includes(".") ? query : null,
    } satisfies ParsedDomainSearchQuery,
  }
}

/**
 * Generate one candidate per enabled catalogue TLD. An exact supported
 * extension is placed first; an unsupported exact extension is deliberately
 * excluded from provider calls and is reported separately by the API.
 */
export function buildDomainSearchCandidates(
  query: ParsedDomainSearchQuery,
  supportedTlds: string[],
) {
  const tlds = Array.from(new Set(
    supportedTlds
      .map((tld) => tld.trim().toLowerCase())
      .filter((tld) => /^\\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/.test(tld)),
  ))
  const exactTld = query.exactDomain
    ? query.exactDomain.slice(query.baseName.length)
    : null
  const exactSupported = exactTld ? tlds.includes(exactTld) : null
  const candidates = tlds.map((tld) => `${query.baseName}${tld}`)

  if (query.exactDomain && exactSupported) {
    return {
      exactSupported,
      candidates: [query.exactDomain, ...candidates.filter((domain) => domain !== query.exactDomain)],
    }
  }

  return { exactSupported, candidates }
}

/** Keep each provider availability request within the existing 10-domain API limit. */
export function chunkDomainNames(domains: string[], batchSize = 10): string[][] {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error("Batch size must be a positive integer.")
  }

  const chunks: string[][] = []
  for (let index = 0; index < domains.length; index += batchSize) {
    chunks.push(domains.slice(index, index + batchSize))
  }
  return chunks
}

/**
 * Legacy validator retained for existing internal callers that submit explicit
 * batches of fully-qualified domains.
 */
export function parseDomainSearchRequest(value: unknown) {
  const parsed = domainSearchRequestSchema.safeParse(value)
  if (!parsed.success || !parsed.data.domains.every(isValidFullyQualifiedDomain)) {
    return { success: false as const }
  }

  return {
    success: true as const,
    data: { domains: parsed.data.domains.filter((domain, index, domains) => domains.indexOf(domain) === index) },
  }
}
