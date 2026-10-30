import "server-only"

import { resolveNameSiloApiConfig } from "./namesilo-config"

const REQUEST_TIMEOUT_MS = 8_000

export type NameSiloStandardTldPrice = {
  tld: string
  registrationUsdMinor: number
  renewalUsdMinor: number
}

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Convert a USD decimal amount to integer cents without floating-point math. */
function parseUsdMinor(value: unknown, field: string): number {
  const text = typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : typeof value === "string" ? value.trim() : ""
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error(`NameSilo returned an invalid ${field} price.`)
  const [whole, fraction = ""] = text.split(".")
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"))
  if (!Number.isSafeInteger(minor) || minor <= 0) throw new Error(`NameSilo returned an unsafe ${field} price.`)
  return minor
}

/** Parse only the documented getPrices reply; missing fees are never guessed. */
export function parseNameSiloStandardPrices(payload: unknown): NameSiloStandardTldPrice[] {
  if (!isRecord(payload) || !isRecord(payload.reply)) throw new Error("NameSilo returned an unrecognized price-list response.")
  const reply = payload.reply
  if (Number(reply.code) !== 300) throw new Error("NameSilo did not confirm the standard price list.")
  const prices: NameSiloStandardTldPrice[] = []
  for (const [rawTld, rawPrice] of Object.entries(reply)) {
    if (["code", "detail"].includes(rawTld)) continue
    const tld = rawTld.toLowerCase().replace(/^\./, "")
    if (!/^[a-z0-9-]{2,63}$/.test(tld) || !isRecord(rawPrice)) continue
    if (rawPrice.registration === undefined || rawPrice.renew === undefined) {
      throw new Error(`NameSilo price data for .${tld} is incomplete.`)
    }
    prices.push({
      tld,
      registrationUsdMinor: parseUsdMinor(rawPrice.registration, `.${tld} registration`),
      renewalUsdMinor: parseUsdMinor(rawPrice.renew, `.${tld} renewal`),
    })
  }
  if (prices.length === 0) throw new Error("NameSilo returned no usable TLD prices.")
  return prices.sort((a, b) => a.tld.localeCompare(b.tld))
}

/** Read-only live-account request for standard pay-as-you-go rates. */
export async function getNameSiloStandardPrices(dependencies: {
  env?: Record<string, string | undefined>
  fetchImpl?: typeof fetch
} = {}): Promise<{ prices: NameSiloStandardTldPrice[]; fetchedAt: string; source: "namesilo-standard-retail" }> {
  const env = dependencies.env ?? process.env
  const fetchImpl = dependencies.fetchImpl ?? fetch
  const { apiBaseUrl, apiKey } = resolveNameSiloApiConfig("live", env)
  const url = new URL(`${apiBaseUrl}/getPrices`)
  url.searchParams.set("version", "1")
  url.searchParams.set("type", "json")
  url.searchParams.set("key", apiKey)
  // Explicitly request public retail rates, not Discount Program account rates.
  url.searchParams.set("retail_prices", "1")
  let response: Response
  try {
    response = await fetchImpl(url, { method: "GET", cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), headers: { Accept: "application/json" } })
  } catch {
    throw new Error("NameSilo standard price request failed or timed out.")
  }
  if (!response.ok) throw new Error(`NameSilo standard price request failed (HTTP ${response.status}).`)
  let payload: unknown
  try { payload = await response.json() } catch { throw new Error("NameSilo returned invalid JSON for its standard price list.") }
  return { prices: parseNameSiloStandardPrices(payload), fetchedAt: new Date().toISOString(), source: "namesilo-standard-retail" }
}