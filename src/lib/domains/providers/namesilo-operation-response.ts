import type { NameSiloSandboxOperation } from "./namesilo-sandbox-contract.ts"
import { normalizeNameSiloSandboxDomain } from "./namesilo-sandbox-contract.ts"

type UnknownRecord = Record<string, unknown>

export type NameSiloMutationState =
  | "acknowledged"
  | "acknowledged_with_warning"
  | "rejected"
  | "ambiguous"
  | "not_attempted"

export type NameSiloMutationOutcome = {
  operation: Exclude<NameSiloSandboxOperation, "checkRegisterAvailability" | "getDomainInfo">
  domain: string
  state: NameSiloMutationState
  providerCode: number | null
  providerOrderAmount: string | null
  reconciliationRequired: boolean
  message: string
}

export type NameSiloSandboxDomainInfo = {
  state: "found" | "unknown"
  domain: string
  providerCode: number | null
  message: string
  providerStatus: string | null
  createdAt: string | null
  expiresAt: string | null
  nameservers: string[]
  locked: boolean | null
  autoRenew: boolean | null
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function textValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim()
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  if (isRecord(value)) {
    for (const key of ["#text", "domain", "name", "value"]) {
      const result = value[key]
      if (typeof result === "string" && result.trim()) return result.trim()
    }
  }
  return null
}

function domainValue(value: unknown): string | null {
  const result = textValue(value)
  return result ? result.toLowerCase() : null
}

function safeProviderDetail(value: unknown): string | null {
  if (typeof value !== "string") return null
  const compact = value.trim().split(/\\s+/).join(" ")
    .replace(/\\b(api[_ -]?key|key)\\s*[:=]\\s*[^\\s,;]+/gi, "$1=[redacted]")
  return compact ? compact.slice(0, 200) : null
}

function booleanValue(value: unknown): boolean | null {
  const normalized = textValue(value)?.toLowerCase()
  if (normalized === "1" || normalized === "true" || normalized === "yes") return true
  if (normalized === "0" || normalized === "false" || normalized === "no") return false
  return null
}

function strings(value: unknown): string[] {
  const values = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value]
  return values.map(textValue).filter((item): item is string => Boolean(item))
}

function unknownDomainInfo(
  domain: string,
  providerCode: number | null = null,
  message = "NameSilo OTE did not confirm the domain information.",
): NameSiloSandboxDomainInfo {
  return {
    state: "unknown",
    domain,
    providerCode,
    message,
    providerStatus: null,
    createdAt: null,
    expiresAt: null,
    nameservers: [],
    locked: null,
    autoRenew: null,
  }
}

/**
 * Mutation API replies are acknowledgements, not the final internal order state.
 * Unrecognized replies remain ambiguous to prevent blind retries after a request
 * may have reached the registrar.
 */
export function parseNameSiloMutationOutcome(
  payload: unknown,
  operation: NameSiloMutationOutcome["operation"],
  requestedDomain: string,
  transportSucceeded = true,
): NameSiloMutationOutcome {
  const domain = normalizeNameSiloSandboxDomain(requestedDomain)
  const base = {
    operation,
    domain,
    providerCode: null as number | null,
    providerOrderAmount: null as string | null,
    reconciliationRequired: true,
  }

  const ambiguous = (providerCode: number | null = null, providerOrderAmount: string | null = null): NameSiloMutationOutcome => ({
    ...base,
    providerCode,
    providerOrderAmount,
    state: "ambiguous",
    reconciliationRequired: true,
    message: "The NameSilo sandbox outcome could not be confirmed. Reconcile provider state before retrying; do not repeat the mutation blindly.",
  })

  if (!transportSucceeded || !isRecord(payload) || !isRecord(payload.reply)) return ambiguous()

  const reply = payload.reply
  const parsedCode = Number(reply.code)
  const providerCode = Number.isInteger(parsedCode) ? parsedCode : null
  const amountValue = textValue(reply.order_amount)
  const providerOrderAmount = amountValue && /^\d+(?:\.\d+)?$/.test(amountValue) ? amountValue : null
  const returnedDomain = domainValue(reply.domain)

  // Recognized NameSilo client/account errors are definite rejections. An
  // unrecognized code remains ambiguous so callers cannot blindly retry.
  const definiteRejection =
    providerCode === 108 || // missing required parameters
    providerCode === 110 || // invalid API key
    providerCode === 111 || // API key IP restriction
    providerCode === 200 || // domain not active or not in this account
    (operation === "registerDomain" && providerCode === 261) // domain unavailable to register

  if (definiteRejection) {
    return {
      ...base,
      providerCode,
      providerOrderAmount,
      state: "rejected",
      reconciliationRequired: false,
      message: providerCode === 110 || providerCode === 111
        ? "NameSilo rejected the sandbox request because the API key or source-IP permissions need checking."
        : "NameSilo rejected the sandbox request. Check the domain state, parameters and account permissions.",
    }
  }

  if (providerCode === 300) {
    if (returnedDomain !== domain) return ambiguous(providerCode, providerOrderAmount)
    return {
      ...base,
      providerCode,
      providerOrderAmount,
      state: "acknowledged",
      reconciliationRequired: true,
      message: "NameSilo acknowledged the sandbox operation. Query domain information and reconcile the result before advancing the internal order.",
    }
  }

  // NameSilo documents these as successful registration/transfer operations
  // with a fallback (nameservers or contact profile). They must not be retried.
  if ((operation === "registerDomain" || operation === "transferDomain") &&
      (providerCode === 301 || providerCode === 302)) {
    if (returnedDomain !== domain) return ambiguous(providerCode, providerOrderAmount)
    return {
      ...base,
      providerCode,
      providerOrderAmount,
      state: "acknowledged_with_warning",
      reconciliationRequired: true,
      message: "NameSilo reports that the sandbox operation succeeded with a fallback. Reconcile domain state and review the fallback before continuing; do not retry.",
    }
  }

  return ambiguous(providerCode, providerOrderAmount)
}

export function parseNameSiloSandboxDomainInfo(
  payload: unknown,
  requestedDomain: string,
  transportSucceeded = true,
): NameSiloSandboxDomainInfo {
  const domain = normalizeNameSiloSandboxDomain(requestedDomain)
  if (!transportSucceeded) {
    return unknownDomainInfo(domain, null, "NameSilo OTE domain-info request failed or timed out.")
  }
  if (!isRecord(payload) || !isRecord(payload.reply)) {
    return unknownDomainInfo(domain, null, "NameSilo OTE returned an unrecognized domain-info response.")
  }

  const reply = payload.reply
  const parsedCode = Number(reply.code)
  const providerCode = Number.isInteger(parsedCode) ? parsedCode : null
  if (providerCode !== 300) {
    const detail = safeProviderDetail(reply.detail)
    const summary = providerCode === 200
      ? "NameSilo OTE reports that the domain is not active or does not belong to this sandbox account."
      : providerCode === 110
        ? "NameSilo OTE rejected the API key."
        : `NameSilo OTE returned response code ${providerCode ?? "unknown"}.`
    const message = detail ? `${summary} Provider detail: ${detail}` : summary
    return unknownDomainInfo(domain, providerCode, message)
  }

  const nested = isRecord(reply.domain) ? reply.domain : reply
  // getDomainInfo's documented reply normally identifies the queried domain
  // through the request and may omit a repeated "domain" property in JSON.
  // If the provider does return an identity, reject a mismatch; don't require
  // an echo field that the API contract doesn't promise.
  const returnedDomain = domainValue(isRecord(reply.domain)
    ? (reply.domain.domain ?? reply.domain.name ?? reply.domain["#text"])
    : reply.domain)

  if (returnedDomain && returnedDomain !== domain) {
    return unknownDomainInfo(domain, providerCode, "NameSilo OTE returned information for a different domain.")
  }

  const nameServerContainer = nested.nameservers ?? nested.nameserver
  const nameServerValue = isRecord(nameServerContainer) && "nameserver" in nameServerContainer
    ? nameServerContainer.nameserver
    : nameServerContainer
  const nameservers = strings(nameServerValue).map((value) => value.toLowerCase())

  const readFirst = (keys: string[]): string | null => {
    for (const key of keys) {
      const value = textValue(nested[key] ?? reply[key])
      if (value) return value
    }
    return null
  }

  return {
    state: "found",
    domain,
    providerCode,
    message: "NameSilo OTE returned domain information for the requested domain.",
    providerStatus: readFirst(["status", "domain_status"]),
    createdAt: readFirst(["created", "create_date", "created_date", "registration_date"]),
    expiresAt: readFirst(["expires", "expiration", "expires_date", "expiration_date"]),
    nameservers,
    locked: booleanValue(nested.locked ?? reply.locked),
    autoRenew: booleanValue(nested.auto_renew ?? nested.autoRenew ?? reply.auto_renew ?? reply.autoRenew),
  }
}

export function createNotAttemptedOutcome(
  operation: NameSiloMutationOutcome["operation"],
  requestedDomain: string,
  message: string,
): NameSiloMutationOutcome {
  return {
    operation,
    domain: normalizeNameSiloSandboxDomain(requestedDomain),
    state: "not_attempted",
    providerCode: null,
    providerOrderAmount: null,
    reconciliationRequired: false,
    message,
  }
}
