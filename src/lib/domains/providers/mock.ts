import type {
  DomainAvailabilityResult,
  DomainProvider,
} from "../types"

/**
 * A deliberately non-claiming adapter for development and architecture tests.
 * It never invents availability or prices and must not be used to fulfil orders.
 */
export const mockDomainProvider: DomainProvider = {
  id: "mock",
  capabilities: {
    availabilitySearch: false,
    registration: false,
    renewal: false,
    transfers: false,
    dnsManagement: false,
    privacyProtection: false,
  },
  async checkAvailability(domains: string[]): Promise<DomainAvailabilityResult[]> {
    const checkedAt = new Date().toISOString()

    return domains.map((domain) => ({
      domain,
      availability: "unknown",
      registrationPrice: null,
      renewalPrice: null,
      checkedAt,
      source: "mock",
      message: "Live registrar availability and pricing are not configured.",
    }))
  },
}
