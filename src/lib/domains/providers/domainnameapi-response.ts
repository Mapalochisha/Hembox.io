import type { DomainAvailability } from "../types"

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function firstString(record: UnknownRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return null
}

function normalizeAvailability(value: unknown): DomainAvailability {
  if (typeof value === "boolean") return value ? "available" : "unavailable"
  if (typeof value !== "string") return "unknown"

  const normalized = value.trim().toLowerCase()
  if (["available", "true", "free", "success_available"].includes(normalized)) return "available"
  if (["unavailable", "false", "registered", "taken", "notavailable", "not_available"].includes(normalized)) {
    return "unavailable"
  }
  return "unknown"
}

/**
 * Provider responses have changed across Domain Name API API generations.
 * Only accept explicit availability fields/statuses; never infer availability
 * from a generic "Success" response.
 */
export function parseDomainNameApiAvailability(
  payload: unknown,
  requestedDomain: string,
): DomainAvailability {
  if (!isRecord(payload)) return "unknown"

  const nested = isRecord(payload.data) ? payload.data : payload
  const returnedDomain = firstString(nested, ["domainName", "domain"])
  if (returnedDomain && returnedDomain.toLowerCase() !== requestedDomain.toLowerCase()) {
    return "unknown"
  }

  const direct = nested.isAvailable ?? nested.available ?? nested.availability
  const directResult = normalizeAvailability(direct)
  if (directResult !== "unknown") return directResult

  const status = firstString(nested, ["domainStatus", "availabilityStatus", "status"])
  if (status) {
    const statusResult = normalizeAvailability(status)
    if (statusResult !== "unknown") return statusResult
  }

  return "unknown"
}
