import "server-only"

import { mockDomainProvider } from "./providers/mock"
import type { DomainProvider } from "./types"

export function getDomainProvider(): DomainProvider {
  const mode = process.env.DOMAIN_PROVIDER_MODE?.trim().toLowerCase() || "disabled"

  if (mode === "mock") return mockDomainProvider

  // Live adapters must be explicitly implemented and configured. Fail closed
  // instead of accidentally calling a provider or showing fabricated prices.
  throw new Error("Domain provider is not configured. Set DOMAIN_PROVIDER_MODE=mock for development.")
}
