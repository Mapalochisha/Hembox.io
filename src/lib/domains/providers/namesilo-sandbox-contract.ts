export const NAMESILO_SANDBOX_API_BASE_URL = "https://ote.namesilo.com/api"

export type NameSiloSandboxOperation =
  | "checkRegisterAvailability"
  | "getDomainInfo"
  | "registerDomain"
  | "renewDomain"
  | "transferDomain"
  | "changeNameServers"

const ALLOWED_OPERATIONS: ReadonlySet<string> = new Set([
  "checkRegisterAvailability",
  "getDomainInfo",
  "registerDomain",
  "renewDomain",
  "transferDomain",
  "changeNameServers",
])

const SUPPORTED_TLDS = [".com", ".net"] as const
const SANDBOX_NAMESERVERS = new Set(
  Array.from({ length: 8 }, (_, index) => `ns${index + 1}.namesilo.com`),
)

function isValidFullyQualifiedDomain(domain: string): boolean {
  const labels = domain.split(".")
  return labels.length >= 2 && labels.every((label) =>
    label.length >= 1 &&
    label.length <= 63 &&
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
  )
}

/** Normalize and validate domains against NameSilo's documented OTE testing guidance. */
export function normalizeNameSiloSandboxDomain(value: unknown): string {
  if (typeof value !== "string") throw new Error("Provide a valid .com or .net sandbox domain.")
  const domain = value.trim().toLowerCase()
  if (!isValidFullyQualifiedDomain(domain) || !SUPPORTED_TLDS.some((tld) => domain.endsWith(tld))) {
    throw new Error("NameSilo OTE testing is restricted to valid .com and .net domains.")
  }
  return domain
}

export function validateNameSiloYears(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 10) {
    throw new Error("Registration or renewal years must be an integer from 1 to 10.")
  }
  return value
}

/** OTE supports only NameSilo's NS1–NS8 hostnames for sandbox nameserver tests. */
export function normalizeNameSiloSandboxNameservers(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 8) {
    throw new Error("Provide between 2 and 8 supported NameSilo sandbox nameservers.")
  }

  const nameservers = value.map((item) => {
    if (typeof item !== "string") throw new Error("Nameservers must be hostnames.")
    return item.trim().toLowerCase().replace(/\.$/, "")
  })

  if (new Set(nameservers).size !== nameservers.length) {
    throw new Error("Nameserver entries must be unique.")
  }
  if (!nameservers.every((nameserver) => SANDBOX_NAMESERVERS.has(nameserver))) {
    throw new Error("NameSilo OTE accepts only ns1.namesilo.com through ns8.namesilo.com for nameserver tests.")
  }

  return nameservers
}

/**
 * Build OTE URLs in one place. The production hostname is never accepted as an
 * input, and reserved query parameters cannot be overridden by operation data.
 * Never log this URL: NameSilo authenticates via a query-string API key.
 */
export function buildNameSiloSandboxUrl(
  apiKey: string,
  operation: NameSiloSandboxOperation,
  parameters: Record<string, string>,
): URL {
  if (!apiKey.trim()) throw new Error("NameSilo sandbox API key is required.")
  if (!ALLOWED_OPERATIONS.has(operation)) throw new Error("Unsupported NameSilo sandbox operation.")

  const url = new URL(`${NAMESILO_SANDBOX_API_BASE_URL}/${operation}`)
  url.searchParams.set("version", "1")
  url.searchParams.set("type", "json")
  url.searchParams.set("key", apiKey)

  for (const [name, value] of Object.entries(parameters)) {
    if (["key", "version", "type"].includes(name.toLowerCase())) {
      throw new Error("Operation parameters may not override reserved API query fields.")
    }
    url.searchParams.set(name, value)
  }

  return url
}
