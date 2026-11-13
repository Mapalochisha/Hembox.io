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
  source: "mock" | "domainnameapi" | "namesilo"
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

export type DomainRegistrationInput = Readonly<{
  domain: string
  years: number
  privateWhois?: boolean
  autoRenew?: boolean
  registrant?: {
    firstName: string
    lastName: string
    organisationName?: string
    email: string
    phone: string
    addressLine1: string
    addressLine2?: string
    city: string
    region: string
    postalCode: string
    countryCode: string
  }
}>

export type DomainRegistrationOutcome = Readonly<{
  domain: string
  operation: string
  state: "acknowledged" | "acknowledged_with_warning" | "ambiguous" | "rejected" | "not_attempted"
  providerCode: number | null
  providerOrderAmount: string | null
  message: string
  reconciliationRequired: boolean
}>

export interface DomainProvider {
  readonly id: string
  readonly environment: "mock" | "test" | "live"
  readonly capabilities: DomainProviderCapabilities
  checkAvailability(domains: string[]): Promise<DomainAvailabilityResult[]>
  registerDomain?(input: DomainRegistrationInput): Promise<DomainRegistrationOutcome>
}
