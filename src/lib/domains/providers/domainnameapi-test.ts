import "server-only"

import { parseDomainNameApiAvailability } from "./domainnameapi-response"
import type {
  DomainAvailability,
  DomainAvailabilityResult,
  DomainProvider,
} from "../types"

const DEFAULT_TEST_BASE_URL = "https://ote.domainresellerapi.com"
const REQUEST_TIMEOUT_MS = 8_000

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error("Domain Name API test credentials are not configured.")
  return value
}

function getTestBaseUrl(): string {
  const configured = process.env.DOMAINNAMEAPI_TEST_BASE_URL?.trim() || DEFAULT_TEST_BASE_URL
  const url = new URL(configured)
  if (url.protocol !== "https:" || url.hostname !== "ote.domainresellerapi.com") {
    throw new Error("Domain Name API test adapter only permits the official OT&E API host.")
  }
  return url.origin
}

export const domainNameApiTestProvider: DomainProvider = {
  id: "domainnameapi-test",
  environment: "test",
  capabilities: {
    availabilitySearch: true,
    registration: false,
    renewal: false,
    transfers: false,
    dnsManagement: false,
    privacyProtection: false,
  },

  async checkAvailability(domains: string[]): Promise<DomainAvailabilityResult[]> {
    const resellerId = getRequiredEnv("DOMAINNAMEAPI_RESELLER_ID")
    const apiKey = getRequiredEnv("DOMAINNAMEAPI_TEST_API_KEY")
    const baseUrl = getTestBaseUrl()

    return Promise.all(domains.map(async (domain): Promise<DomainAvailabilityResult> => {
      const checkedAt = new Date().toISOString()

      try {
        const response = await fetch(`${baseUrl}/v1/domain/check`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ resellerId, apiKey, domain }),
          cache: "no-store",
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        })

        if (!response.ok) {
          // Do not return provider error bodies: they may contain account details.
          return {
            domain,
            availability: "unknown",
            registrationPrice: null,
            renewalPrice: null,
            checkedAt,
            source: "domainnameapi",
            message: response.status === 401 || response.status === 403
              ? "Domain provider authentication or permissions need checking."
              : "The test registrar could not confirm availability.",
          }
        }

        const payload: unknown = await response.json()
        const availability = parseDomainNameApiAvailability(payload, domain)

        return {
          domain,
          availability,
          registrationPrice: null,
          renewalPrice: null,
          checkedAt,
          source: "domainnameapi",
          message: availability === "unknown"
            ? "The test registrar returned an unrecognized availability response; no result was inferred."
            : "Result returned by the Domain Name API test environment. It does not confirm live registry availability.",
        }
      } catch {
        return {
          domain,
          availability: "unknown",
          registrationPrice: null,
          renewalPrice: null,
          checkedAt,
          source: "domainnameapi",
          message: "The test registrar request failed or timed out; availability remains unknown.",
        }
      }
    }))
  },
}
