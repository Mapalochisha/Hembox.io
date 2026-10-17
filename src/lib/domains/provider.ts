import "server-only"

import { domainNameApiTestProvider } from "./providers/domainnameapi-test"
import { mockDomainProvider } from "./providers/mock"
import type { DomainProvider } from "./types"

export function getDomainProvider(): DomainProvider {
  const mode = process.env.DOMAIN_PROVIDER_MODE?.trim().toLowerCase() || "disabled"

  if (mode === "mock") return mockDomainProvider
  if (mode === "domainnameapi-test") return domainNameApiTestProvider

  // Live adapters are intentionally not implemented. Never infer production
  // access from the presence of a test key or silently fall back to live.
  throw new Error(
    "Domain provider is not configured. Set DOMAIN_PROVIDER_MODE=mock for development or domainnameapi-test for OT&E.",
  )
}
