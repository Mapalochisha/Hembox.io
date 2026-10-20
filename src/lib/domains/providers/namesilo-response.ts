import type { DomainAvailability } from "../types"

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function domainValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim().toLowerCase()
  if (!isRecord(value)) return null

  for (const key of ["#text", "domain", "name", "value"]) {
    const candidate = value[key]
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim().toLowerCase()
  }
  return null
}

function collectDomains(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value]
  return values.map(domainValue).filter((domain): domain is string => domain !== null)
}

/**
 * Parse NameSilo's documented checkRegisterAvailability JSON shape.
 * Only domains explicitly listed under reply.available/unavailable are trusted.
 * Invalid, missing, mismatched and unrecognized results remain unknown.
 */
export function parseNameSiloAvailability(
  payload: unknown,
  requestedDomains: string[],
): Map<string, DomainAvailability> {
  const result = new Map<string, DomainAvailability>()
  for (const domain of requestedDomains) result.set(domain.toLowerCase(), "unknown")

  if (!isRecord(payload) || !isRecord(payload.reply)) return result
  const reply = payload.reply
  if (Number(reply.code) !== 300) return result

  const available = isRecord(reply.available) ? collectDomains(reply.available.domain) : []
  const unavailable = isRecord(reply.unavailable) ? collectDomains(reply.unavailable.domain) : []
  const invalid = isRecord(reply.invalid) ? collectDomains(reply.invalid.domain) : []
  const requested = new Set(requestedDomains.map((domain) => domain.toLowerCase()))

  for (const domain of available) {
    if (requested.has(domain)) result.set(domain, "available")
  }
  for (const domain of unavailable) {
    if (requested.has(domain)) result.set(domain, "unavailable")
  }
  // Invalid names should not normally pass local validation. Keep them unknown
  // rather than treating invalid as registered or available.
  for (const domain of invalid) {
    if (requested.has(domain)) result.set(domain, "unknown")
  }

  return result
}
