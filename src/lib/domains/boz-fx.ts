export const DEFAULT_BOZ_FX_FEED_URL = "https://allratestoday.com/api/open/central-bank/boz"
export const BOZ_OFFICIAL_RATE_PAGE = "https://www.boz.zm/markets-securities/boz-exchange-rates"
export const BOZ_FX_BUFFER_ZMW = 1
const MAX_RATE_AGE_DAYS = 5

export type BozFxRate = {
  rateDate: string
  midRate: number
  sourceUrl: string
  retrievedAt: string
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function numberValue(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN
  return Number.isFinite(parsed) && parsed > 0 && parsed < 1000 ? parsed : null
}

/** Parse only a published, non-derived USD/ZMW middle rate from the BoZ feed. */
export function parseBozFxPayload(payload: unknown, retrievedAt = new Date().toISOString()): BozFxRate {
  if (!payload || typeof payload !== "object") throw new Error("BoZ FX response was not an object.")
  const root = payload as Record<string, unknown>
  const data = root.data && typeof root.data === "object" ? root.data as Record<string, unknown> : root
  const bank = String(data.bank ?? root.bank ?? data.code ?? root.code ?? data.name ?? root.name ?? "").toLowerCase()
  if (!bank.includes("boz") && !bank.includes("bank of zambia")) throw new Error("FX feed did not identify Bank of Zambia.")
  const rateDate = data.rate_date ?? data.rateDate ?? data.date
  if (!validDate(rateDate)) throw new Error("BoZ FX feed did not include a valid publication date.")

  const rates = Array.isArray(data.rates) ? data.rates as Array<Record<string, unknown>> : []
  const row = rates.find((candidate) =>
    String(candidate.base ?? candidate.source ?? "").toUpperCase() === "USD" &&
    String(candidate.quote ?? candidate.target ?? "").toUpperCase() === "ZMW" &&
    ["middle", "mid", "mid-rate", "mid_rate"].includes(String(candidate.type ?? candidate.rate_type ?? "").toLowerCase()),
  )
  const rateType = String(row?.type ?? row?.rate_type ?? data.rate_type ?? data.type ?? "").toLowerCase()
  if (!["middle", "mid", "mid-rate", "mid_rate"].includes(rateType)) throw new Error("BoZ FX feed did not identify a middle rate.")
  const direct = row?.value ?? data.rate ?? data.mid_rate ?? data.midRate
  if (row?.derived === true || data.derived === true) throw new Error("Derived FX rates are not accepted; a directly published BoZ rate is required.")
  const midRate = numberValue(direct)
  if (midRate === null) throw new Error("BoZ FX feed did not contain a published USD/ZMW middle rate.")

  const published = new Date(`${rateDate}T00:00:00.000Z`).getTime()
  const retrieved = Date.parse(retrievedAt)
  if (!Number.isFinite(retrieved) || published > retrieved + 24 * 60 * 60 * 1000) throw new Error("BoZ FX publication date is in the future.")
  const ageDays = (retrieved - published) / 86_400_000
  if (ageDays > MAX_RATE_AGE_DAYS) throw new Error("BoZ FX publication is more than five days old; refusing to refresh prices.")

  return {
    rateDate,
    midRate,
    sourceUrl: BOZ_OFFICIAL_RATE_PAGE,
    retrievedAt,
  }
}

export async function fetchBozFxRate(options: {
  endpoint?: string
  fetchImpl?: typeof fetch
  now?: Date
} = {}): Promise<BozFxRate> {
  const endpoint = options.endpoint || process.env.BOZ_FX_API_URL || DEFAULT_BOZ_FX_FEED_URL
  const fetchImpl = options.fetchImpl || fetch
  const retrievedAt = (options.now || new Date()).toISOString()
  const response = await fetchImpl(endpoint, {
    method: "GET",
    headers: { Accept: "application/json", "User-Agent": "HEMBOX-DomainPricing/1.0" },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  })
  if (!response.ok) throw new Error(`BoZ FX feed returned HTTP ${response.status}.`)
  const payload: unknown = await response.json()
  return parseBozFxPayload(payload, retrievedAt)
}
