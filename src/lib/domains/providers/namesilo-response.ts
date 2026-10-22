import type { DomainAvailability } from "../types"

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function domainValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim().toLowerCase()
  if (!isRecord(value)) return null

  // JSON representations of NameSilo's XML API may use either $t or #text.
  for (const key of ["$t", "#text", "domain", "name", "value"]) {
    const candidate = value[key]
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim().toLowerCase()
  }
  return null
}

function collectDomains(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectDomains)

  const direct = domainValue(value)
  if (direct) return [direct]

  if (isRecord(value) && "domain" in value) return collectDomains(value.domain)
  return []
}

function collectBucket(value: unknown): string[] {
  // Accept nested { domain: ... }, array-of-records, and plain-string arrays.
  if (isRecord(value) && "domain" in value) return collectDomains(value.domain)
  return collectDomains(value)
}

/**
 * Parse NameSilo's checkRegisterAvailability reply.
 * Only requested domains explicitly listed in a recognized bucket are trusted.
 * Missing, invalid, contradictory and unrecognized results remain unknown.
 */
export function parseNameSiloAvailability(
  payload: unknown,
  requestedDomains: string[],
): Map<string, DomainAvailability> {
  const result = new Map<string, DomainAvailability>()
  const requestedDomainsNormalized = Array.from(new Set(
    requestedDomains.map((domain) => domain.trim().toLowerCase()),
  ))
  const requested = new Set(requestedDomainsNormalized)
  for (const domain of requestedDomainsNormalized) result.set(domain, "unknown")

  if (!isRecord(payload) || !isRecord(payload.reply)) return result
  const reply = payload.reply
  if (Number(reply.code) !== 300) return result

  const available = new Set(collectBucket(reply.available))
  const unavailable = new Set(collectBucket(reply.unavailable))
  const invalid = new Set(collectBucket(reply.invalid))

  for (const domain of requestedDomainsNormalized) {
    const isAvailable = available.has(domain)
    const isUnavailable = unavailable.has(domain)
    if (invalid.has(domain) || (isAvailable && isUnavailable)) {
      result.set(domain, "unknown")
    } else if (isAvailable) {
      result.set(domain, "available")
    } else if (isUnavailable) {
      result.set(domain, "unavailable")
    }
  }

  return result
}
