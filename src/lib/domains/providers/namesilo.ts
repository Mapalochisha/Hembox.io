import "server-only"

import { parseNameSiloAvailability } from "./namesilo-response"
import { parseNameSiloMutationOutcome, createNotAttemptedOutcome } from "./namesilo-operation-response"
import { resolveNameSiloApiConfig, type NameSiloEnvironment } from "./namesilo-config"
import type {
  DomainAvailabilityResult,
  DomainProvider,
  DomainRegistrationInput,
  DomainRegistrationOutcome,
} from "../types"

const REQUEST_TIMEOUT_MS = 8_000

/**
 * NameSilo adapter. Availability search is available in both sandbox and live
 * modes. Domain registration is available in live mode only and requires a
 * live NameSilo API key; it performs a real registrar API call and should only
 * be used after verified pricing, confirmed availability, and settled payment.
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
      registration: environment === "live",
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

    async registerDomain(input: DomainRegistrationInput): Promise<DomainRegistrationOutcome> {
      if (environment !== "live") {
        return createNotAttemptedOutcome(
          "registerDomain",
          input.domain,
          "NameSilo registration is only available in live mode.",
        )
      }

      const { apiBaseUrl, apiKey } = resolveNameSiloApiConfig("live")
      const domain = input.domain.trim().toLowerCase()
      const years = input.years

      if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(domain)) {
        return createNotAttemptedOutcome("registerDomain", domain, "Invalid domain name.")
      }
      if (!Number.isInteger(years) || years < 1 || years > 10) {
        return createNotAttemptedOutcome("registerDomain", domain, "Registration years must be an integer from 1 to 10.")
      }
      if (!input.registrant) {
        return createNotAttemptedOutcome("registerDomain", domain, "Registrant details are required for registration.")
      }

      const registrant = input.registrant
      const parameters: Record<string, string> = {
        domain,
        years: String(years),
        private: input.privateWhois ? "1" : "0",
        auto_renew: input.autoRenew ? "1" : "0",
      }
      if (registrant.firstName.trim()) parameters.fn = registrant.firstName.trim()
      if (registrant.lastName.trim()) parameters.ln = registrant.lastName.trim()
      if (registrant.organisationName?.trim()) parameters.cp = registrant.organisationName.trim()
      if (registrant.email.trim()) parameters.em = registrant.email.trim()
      if (registrant.phone.trim()) parameters.ph = registrant.phone.trim()
      if (registrant.addressLine1.trim()) parameters.ad = registrant.addressLine1.trim()
      if (registrant.addressLine2?.trim()) parameters.ad2 = registrant.addressLine2.trim()
      if (registrant.city.trim()) parameters.cy = registrant.city.trim()
      if (registrant.region.trim()) parameters.st = registrant.region.trim()
      if (registrant.postalCode?.trim()) parameters.zp = registrant.postalCode.trim()
      if (registrant.countryCode?.trim()) parameters.ct = registrant.countryCode.trim()

      const url = new URL(`${apiBaseUrl}/registerDomain`)
      url.searchParams.set("version", "1")
      url.searchParams.set("type", "json")
      url.searchParams.set("key", apiKey)
      for (const [name, value] of Object.entries(parameters)) {
        if (["key", "version", "type"].includes(name.toLowerCase())) {
          return createNotAttemptedOutcome("registerDomain", domain, "Reserved parameter name.")
        }
        url.searchParams.set(name, value)
      }

      // Do not log url: NameSilo puts API authentication in the query string.
      try {
        const response = await fetch(url, {
          method: "GET",
          cache: "no-store",
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          headers: { Accept: "application/json" },
        })

        if (!response.ok) {
          return {
            operation: "registerDomain",
            domain,
            state: "ambiguous",
            providerCode: null,
            providerOrderAmount: null,
            reconciliationRequired: true,
            message: `NameSilo registration request returned HTTP ${response.status}. Reconcile provider state before retrying.`,
          }
        }

        const payload: unknown = await response.json()
        return parseNameSiloMutationOutcome(payload, "registerDomain", domain, true)
      } catch {
        return {
          operation: "registerDomain",
          domain,
          state: "ambiguous",
          providerCode: null,
          providerOrderAmount: null,
          reconciliationRequired: true,
          message: "NameSilo registration request failed or timed out. Reconcile provider state before retrying; do not repeat the mutation blindly.",
        }
      }
    },
  }
}

export const nameSiloProvider = createNameSiloProvider("live")
export const nameSiloSandboxProvider = createNameSiloProvider("test")
