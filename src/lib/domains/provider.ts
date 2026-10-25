import "server-only"

import { nameSiloProvider, nameSiloSandboxProvider } from "./providers/namesilo"
import { mockDomainProvider } from "./providers/mock"
import type { DomainProvider } from "./types"

export function getDomainProvider(): DomainProvider {
  const mode = process.env.DOMAIN_PROVIDER_MODE?.trim().toLowerCase() || "disabled"

  if (mode === "mock") return mockDomainProvider
  if (mode === "namesilo") return nameSiloProvider
  if (mode === "namesilo-sandbox") return nameSiloSandboxProvider

  // Domain Name API has been retired as the selected integration. Do not
  // silently route old environment configuration to another provider.
  throw new Error(
    "Domain provider is not configured. Set DOMAIN_PROVIDER_MODE=mock for development, namesilo-sandbox for OTE availability checks, or namesilo for production-endpoint availability checks.",
  )
}
