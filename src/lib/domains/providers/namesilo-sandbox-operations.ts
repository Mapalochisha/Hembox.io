// Node-only sandbox utility: kept out of customer-facing routes. The node:buffer
// import also prevents this module from being treated as browser-compatible.
import { Buffer } from "node:buffer"

import { parseNameSiloAvailability } from "./namesilo-response.ts"
import { resolveNameSiloApiConfig } from "./namesilo-config.ts"
import {
  buildNameSiloSandboxUrl,
  normalizeNameSiloSandboxDomain,
  normalizeNameSiloSandboxNameservers,
  validateNameSiloYears,
  NAMESILO_SANDBOX_API_BASE_URL,
  type NameSiloSandboxOperation,
} from "./namesilo-sandbox-contract.ts"
import {
  createNotAttemptedOutcome,
  parseNameSiloMutationOutcome,
  parseNameSiloSandboxDomainInfo,
  type NameSiloMutationOutcome,
  type NameSiloSandboxDomainInfo,
} from "./namesilo-operation-response.ts"

const REQUEST_TIMEOUT_MS = 8_000
const CONFIRM_SANDBOX_ONLY = "OTE_ONLY" as const

type ApiResult = {
  transportSucceeded: boolean
  payload: unknown
}

type ProviderReplyDiagnostics = {
  code: number | null
  detail: string | null
}

function safeProviderDetail(value: unknown): string | null {
  if (typeof value !== "string") return null
  const compact = value.trim().split(/\s+/).join(" ")
    .replace(/\b(api[_ -]?key|key)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]")
  return compact ? compact.slice(0, 200) : null
}

function getProviderReplyDiagnostics(payload: unknown): ProviderReplyDiagnostics {
  if (typeof payload !== "object" || payload === null || !("reply" in payload)) {
    return { code: null, detail: null }
  }
  const reply = payload.reply
  if (typeof reply !== "object" || reply === null) return { code: null, detail: null }
  const rawCode = "code" in reply ? Number(reply.code) : Number.NaN
  return {
    code: Number.isInteger(rawCode) ? rawCode : null,
    detail: "detail" in reply ? safeProviderDetail(reply.detail) : null,
  }
}

type SandboxDependencies = {
  env?: Record<string, string | undefined>
  fetchImpl?: typeof fetch
}

type MutatingConfirmation = {
  confirmSandboxOnly: typeof CONFIRM_SANDBOX_ONLY
}

export type NameSiloSandboxOperations = {
  checkAvailability(domains: string[]): Promise<Array<{
    domain: string
    availability: "available" | "unavailable" | "unknown"
    providerCode: number | null
    message: string
  }>>
  getDomainInfo(domain: string): Promise<NameSiloSandboxDomainInfo>
  registerDomain(input: MutatingConfirmation & {
    domain: string
    years: number
    privateWhois?: boolean
    autoRenew?: boolean
    contactId?: string
  }): Promise<NameSiloMutationOutcome>
  renewDomain(input: MutatingConfirmation & { domain: string; years: number }): Promise<NameSiloMutationOutcome>
  transferDomain(input: MutatingConfirmation & {
    domain: string
    authorizationCode: string
    privateWhois?: boolean
    autoRenew?: boolean
  }): Promise<NameSiloMutationOutcome>
  changeNameServers(input: MutatingConfirmation & { domain: string; nameservers: string[] }): Promise<NameSiloMutationOutcome>
}

/**
 * Explicit OTE-only operations tool. There is no production-host option in this
 * module. It is not wired to a customer-facing API route; callers must choose
 * the OTE confirmation token for every state-changing operation.
 */
export function createNameSiloSandboxOperations(dependencies: SandboxDependencies = {}): NameSiloSandboxOperations {
  const env = dependencies.env ?? process.env
  const fetchImpl = dependencies.fetchImpl ?? fetch

  function assertSandboxMode(): void {
    if (env.DOMAIN_PROVIDER_MODE?.trim().toLowerCase() !== "namesilo-sandbox") {
      throw new Error("NameSilo OTE operations require DOMAIN_PROVIDER_MODE=namesilo-sandbox.")
    }
  }

  function assertMutationConfirmation(value: unknown): asserts value is typeof CONFIRM_SANDBOX_ONLY {
    if (value !== CONFIRM_SANDBOX_ONLY) {
      throw new Error('State-changing NameSilo test calls require confirmSandboxOnly: "OTE_ONLY".')
    }
  }

  async function call(operation: NameSiloSandboxOperation, parameters: Record<string, string>): Promise<ApiResult> {
    assertSandboxMode()
    const config = resolveNameSiloApiConfig("test", env)
    if (config.apiBaseUrl !== NAMESILO_SANDBOX_API_BASE_URL) {
      throw new Error("NameSilo OTE endpoint mismatch; request aborted.")
    }

    // Do not log url: NameSilo puts API authentication in the query string.
    const url = buildNameSiloSandboxUrl(config.apiKey, operation, parameters)
    try {
      const response = await fetchImpl(url, {
        method: "GET",
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: { Accept: "application/json" },
      })
      if (!response.ok) return { transportSucceeded: false, payload: null }
      return { transportSucceeded: true, payload: await response.json() as unknown }
    } catch {
      // For mutations, a timeout/network failure is ambiguous: the registrar may
      // have processed the request before the response was lost.
      return { transportSucceeded: false, payload: null }
    }
  }

  async function domainInfo(domainInput: string): Promise<NameSiloSandboxDomainInfo> {
    const domain = normalizeNameSiloSandboxDomain(domainInput)
    const result = await call("getDomainInfo", { domain })
    return parseNameSiloSandboxDomainInfo(result.payload, domain, result.transportSucceeded)
  }

  async function checkAvailability(domainsInput: string[]) {
    const domains = Array.from(new Set(domainsInput.map(normalizeNameSiloSandboxDomain)))
    if (domains.length < 1 || domains.length > 10) {
      throw new Error("Check between 1 and 10 .com/.net domains in one sandbox request.")
    }
    const result = await call("checkRegisterAvailability", { domains: domains.join(",") })
    if (!result.transportSucceeded) {
      return domains.map((domain) => ({
        domain,
        availability: "unknown" as const,
        providerCode: null,
        message: "NameSilo OTE availability request failed or timed out.",
      }))
    }

    const parsed = parseNameSiloAvailability(result.payload, domains)
    const diagnostics = getProviderReplyDiagnostics(result.payload)

    return domains.map((domain) => {
      const availability = parsed.get(domain) ?? "unknown"
      const message = availability !== "unknown"
        ? "Availability reported by NameSilo OTE. It is not a live-registry guarantee."
        : diagnostics.code === 300
          ? `NameSilo OTE returned code 300 but no recognized availability entry matched this domain.${diagnostics.detail ? ` Provider detail: ${diagnostics.detail}` : ""}`
          : `NameSilo OTE returned response code ${diagnostics.code ?? "unknown"}.${diagnostics.detail ? ` Provider detail: ${diagnostics.detail}` : ""}`

      return { domain, availability, providerCode: diagnostics.code, message }
    })
  }

  async function registerDomain(input: Parameters<NameSiloSandboxOperations["registerDomain"]>[0]) {
    assertMutationConfirmation(input.confirmSandboxOnly)
    const domain = normalizeNameSiloSandboxDomain(input.domain)
    const years = validateNameSiloYears(input.years)

    // Preflight is a safety check, not a reservation. NameSilo performs the
    // authoritative check when registerDomain is submitted.
    const availability = await checkAvailability([domain])
    if (availability[0]?.availability !== "available") {
      return createNotAttemptedOutcome(
        "registerDomain",
        domain,
        "Registration was not attempted because OTE did not explicitly report this domain as available.",
      )
    }

    const parameters: Record<string, string> = {
      domain,
      years: String(years),
      private: input.privateWhois ? "1" : "0",
      auto_renew: input.autoRenew ? "1" : "0",
    }
    if (input.contactId?.trim()) parameters.contact_id = input.contactId.trim()

    const result = await call("registerDomain", parameters)
    return parseNameSiloMutationOutcome(result.payload, "registerDomain", domain, result.transportSucceeded)
  }

  async function renewDomain(input: Parameters<NameSiloSandboxOperations["renewDomain"]>[0]) {
    assertMutationConfirmation(input.confirmSandboxOnly)
    const domain = normalizeNameSiloSandboxDomain(input.domain)
    const years = validateNameSiloYears(input.years)
    const existing = await domainInfo(domain)
    if (existing.state !== "found") {
      return createNotAttemptedOutcome(
        "renewDomain",
        domain,
        "Renewal was not attempted because OTE domain information could not confirm that the domain is in the sandbox account.",
      )
    }
    // NameSilo's renewDomain can restore a domain during its restoration period.
    // This tool only allows renewal for an active sandbox domain, avoiding
    // accidental restoration charges. Restoration needs a separate explicit flow.
    if (existing.providerStatus?.toLowerCase() !== "active") {
      return createNotAttemptedOutcome(
        "renewDomain",
        domain,
        "Renewal was not attempted because the sandbox domain is not confirmed active. Expired/processing domains require separate review.",
      )
    }

    const result = await call("renewDomain", { domain, years: String(years) })
    return parseNameSiloMutationOutcome(result.payload, "renewDomain", domain, result.transportSucceeded)
  }

  async function transferDomain(input: Parameters<NameSiloSandboxOperations["transferDomain"]>[0]) {
    assertMutationConfirmation(input.confirmSandboxOnly)
    const domain = normalizeNameSiloSandboxDomain(input.domain)
    const authorizationCode = input.authorizationCode.trim()
    if (!authorizationCode) throw new Error("A transfer authorization code is required.")
    const encodedAuth = `base64:${Buffer.from(authorizationCode, "utf8").toString("base64")}`

    const result = await call("transferDomain", {
      domain,
      auth: encodedAuth,
      private: input.privateWhois ? "1" : "0",
      auto_renew: input.autoRenew ? "1" : "0",
    })
    return parseNameSiloMutationOutcome(result.payload, "transferDomain", domain, result.transportSucceeded)
  }

  async function changeNameServers(input: Parameters<NameSiloSandboxOperations["changeNameServers"]>[0]) {
    assertMutationConfirmation(input.confirmSandboxOnly)
    const domain = normalizeNameSiloSandboxDomain(input.domain)
    const nameservers = normalizeNameSiloSandboxNameservers(input.nameservers)
    const existing = await domainInfo(domain)
    if (existing.state !== "found") {
      return createNotAttemptedOutcome(
        "changeNameServers",
        domain,
        "Nameserver change was not attempted because OTE domain information could not confirm that the domain is in the sandbox account.",
      )
    }
    if (existing.providerStatus?.toLowerCase() !== "active") {
      return createNotAttemptedOutcome(
        "changeNameServers",
        domain,
        "Nameserver change was not attempted because the sandbox domain is not confirmed active.",
      )
    }

    const parameters: Record<string, string> = { domain }
    nameservers.forEach((nameserver, index) => { parameters[`ns${index + 1}`] = nameserver })

    const result = await call("changeNameServers", parameters)
    return parseNameSiloMutationOutcome(result.payload, "changeNameServers", domain, result.transportSucceeded)
  }

  return { checkAvailability, getDomainInfo: domainInfo, registerDomain, renewDomain, transferDomain, changeNameServers }
}
