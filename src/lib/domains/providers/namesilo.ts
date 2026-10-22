import "server-only"

import { parseNameSiloAvailability } from "./namesilo-response"
import { resolveNameSiloApiConfig, type NameSiloEnvironment } from "./namesilo-config"
import type { DomainAvailabilityResult, DomainProvider } from "../types"

const REQUEST_TIMEOUT_MS = 8_000

/**
 * Read-only NameSilo adapter. Endpoint and key are selected together by the
 * explicit environment. This adapter only checks availability; it cannot
 * register, renew, transfer or change DNS settings.
 *
 * NameSilo's API requires the key in the query string. Never log request URLs
 * or provider response bodies because they can contain credentials/account data.
 */
export function createNameSiloProvider(environment: NameSiloEnvironment): DomainProvider {
  return {
    id: "namesilo",
    environment,
    capabilities: {
      availabilitySearch: true,
      registration: false,
      renewal: false,
      transfers: false,
      dnsManagement: false,
      privacyProtection: false,
    },

    async checkAvailability(domains: string[]): Promise<DomainAvailabilityResult[]> {
      const { apiBaseUrl, apiKey } = resolveNameSiloApiConfig(environment)
      const checkedAt = new Date().toISOString()
      const url = new URL(`${apiBaseUrl}/checkRegisterAvailability`)
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
          const label = environment === "test" ? "NameSilo sandbox" : "NameSilo"
          return domains.map((domain) => ({
            domain,
            availability: "unknown",
            registrationPrice: null,
            renewalPrice: null,
            checkedAt,
            source: "namesilo",
            message: response.status === 401 || response.status === 403
              ? `${label} authentication or API permissions need checking.`
              : `${label} could not confirm availability.`,
          }))
        }

        const payload: unknown = await response.json()
        const availability = parseNameSiloAvailability(payload, domains)
        const label = environment === "test" ? "NameSilo sandbox" : "NameSilo"

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
              ? `${label} did not return a recognized result for this domain; availability remains unconfirmed.`
              : `Availability reported by ${label}. Final availability and price must be rechecked before purchase.`,
          }
        })
      } catch {
        const label = environment === "test" ? "NameSilo sandbox" : "NameSilo"
        return domains.map((domain) => ({
          domain,
          availability: "unknown",
          registrationPrice: null,
          renewalPrice: null,
          checkedAt,
          source: "namesilo",
          message: `${label} request failed or timed out; availability remains unknown.`,
        }))
      }
    },
  }
}

export const nameSiloProvider = createNameSiloProvider("live")
export const nameSiloSandboxProvider = createNameSiloProvider("test")
