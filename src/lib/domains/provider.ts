import "server-only"

import { nameSiloProvider } from "./providers/namesilo"
import { mockDomainProvider } from "./providers/mock"
import type { DomainProvider } from "./types"

export function getDomainProvider(): DomainProvider {
  const mode = process.env.DOMAIN_PROVIDER_MODE?.trim().toLowerCase() || "disabled"

  if (mode === "mock") return mockDomainProvider
  if (mode === "namesilo") return nameSiloProvider

  // Domain Name API has been retired as the selected integration. Do not
  // silently route old environment configuration to another provider.
  throw new Error(
    "Domain provider is not configured. Set DOMAIN_PROVIDER_MODE=mock for development or namesilo for NameSilo availability checks.",
  )
}
