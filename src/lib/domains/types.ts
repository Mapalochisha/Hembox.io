export type DomainAvailability = "available" | "unavailable" | "unknown"

export type DomainPrice = {
  amountMinor: number
  currency: string
  periodYears: number
}

export type DomainAvailabilityResult = {
  domain: string
  availability: DomainAvailability
  registrationPrice: DomainPrice | null
  renewalPrice: DomainPrice | null
  checkedAt: string
  source: "mock" | "domainnameapi"
  message?: string
}

export type DomainProviderCapabilities = {
  availabilitySearch: boolean
  registration: boolean
  renewal: boolean
  transfers: boolean
  dnsManagement: boolean
  privacyProtection: boolean
}

export interface DomainProvider {
  readonly id: string
  readonly environment: "mock" | "test" | "live"
  readonly capabilities: DomainProviderCapabilities
  checkAvailability(domains: string[]): Promise<DomainAvailabilityResult[]>
}
