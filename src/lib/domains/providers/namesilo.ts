import "server-only"

import { parseNameSiloAvailability } from "./namesilo-response"
import type { DomainAvailabilityResult, DomainProvider } from "../types"

const API_BASE_URL = "https://www.namesilo.com/api"
const REQUEST_TIMEOUT_MS = 8_000

function getApiKey(): string {
  const key = process.env.NAMESILO_API_KEY?.trim()
  if (!key) throw new Error("NameSilo API credentials are not configured.")
  return key
}

/**
 * Read-only NameSilo adapter. This adapter only checks registration
 * availability; it cannot register, renew, transfer or change DNS settings.
 * NameSilo's documented API requires GET requests with the key in the query.
 * Never log request URLs or provider response bodies because they can contain
 * sensitive account information.
 */
export const nameSiloProvider: DomainProvider = {
  id: "namesilo",
  environment: "live",
  capabilities: {
    availabilitySearch: true,
    registration: false,
    renewal: false,
    transfers: false,
    dnsManagement: false,
    privacyProtection: false,
  },

  async checkAvailability(domains: string[]): Promise<DomainAvailabilityResult[]> {
    const apiKey = getApiKey()
    const checkedAt = new Date().toISOString()
    const url = new URL(`${API_BASE_URL}/checkRegisterAvailability`)
    url.searchParams.set("version", "1")
    url.searchParams.set("type", "json")
    url.searchParams.set("key", apiKey)
    url.searchParams.set("domains", domains.join(","))

    try {
      const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: { Accept: "application/json" },
      })

      if (!response.ok) {
        return domains.map((domain) => ({
          domain,
          availability: "unknown",
          registrationPrice: null,
          renewalPrice: null,
          checkedAt,
          source: "namesilo",
          message: response.status === 401 || response.status === 403
            ? "NameSilo authentication or API permissions need checking."
            : "NameSilo could not confirm availability.",
        }))
      }

      const payload: unknown = await response.json()
      const availability = parseNameSiloAvailability(payload, domains)

      return domains.map((domain) => {
        const state = availability.get(domain.toLowerCase()) ?? "unknown"
        return {
          domain,
          availability: state,
          registrationPrice: null,
          renewalPrice: null,
          checkedAt,
          source: "namesilo" as const,
          message: state === "unknown"
            ? "NameSilo did not return a recognized result for this domain; availability remains unconfirmed."
            : "Availability reported by NameSilo. Final availability and price must be rechecked before purchase.",
        }
      })
    } catch {
      return domains.map((domain) => ({
        domain,
        availability: "unknown",
        registrationPrice: null,
        renewalPrice: null,
        checkedAt,
        source: "namesilo",
        message: "The NameSilo request failed or timed out; availability remains unknown.",
      }))
    }
  },
}
