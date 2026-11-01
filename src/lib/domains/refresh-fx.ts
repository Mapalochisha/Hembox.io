import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceClient } from "@/lib/supabase/service"
import { calculateRetailPrice, DEFAULT_MINIMUM_MARGIN_ZMW_MINOR } from "./pricing"
import { BOZ_FX_BUFFER_ZMW, fetchBozFxRate } from "./boz-fx"

type CatalogEntry = {
  tld: string
  provider_id: string
  wholesale_currency: string
  registration_wholesale_minor: number | null
  renewal_wholesale_minor: number | null
}

export async function refreshBozFxAndReprice() {
  const rate = await fetchBozFxRate()
  const effectiveRate = rate.midRate + BOZ_FX_BUFFER_ZMW
  const fxRateMicros = Math.round(effectiveRate * 1_000_000)
  if (!Number.isSafeInteger(fxRateMicros)) throw new Error("Effective FX rate is outside the supported range.")

  const supabase = createServiceClient() as unknown as SupabaseClient
  const fxSnapshot = {
    source: "bank-of-zambia",
    base_currency: "USD",
    quote_currency: "ZMW",
    published_rate: rate.midRate,
    buffer_zmw: BOZ_FX_BUFFER_ZMW,
    effective_rate: effectiveRate,
    rate_date: rate.rateDate,
    official_source_url: rate.sourceUrl,
    retrieval_source_url: process.env.BOZ_FX_API_URL || "https://allratestoday.com/api/open/central-bank/boz",
    retrieved_at: rate.retrievedAt,
  }

  const { error: fxError } = await supabase
    .from("domain_fx_rate_snapshots")
    .upsert(fxSnapshot, { onConflict: "source,base_currency,quote_currency,rate_date" })
  if (fxError) throw new Error("Could not persist the Bank of Zambia FX snapshot.")

  const { data, error } = await supabase
    .from("domain_tld_catalog")
    .select("tld,provider_id,wholesale_currency,registration_wholesale_minor,renewal_wholesale_minor")
  if (error) throw new Error("Could not load the TLD catalogue for repricing.")

  const rows = (data ?? []) as CatalogEntry[]
  const updated: string[] = []
  const skipped: string[] = []
  const now = new Date().toISOString()

  for (const row of rows) {
    if (row.wholesale_currency !== "USD" || row.registration_wholesale_minor === null || row.renewal_wholesale_minor === null) {
      skipped.push(row.tld)
      continue
    }

    const registration = calculateRetailPrice({
      wholesaleMinor: row.registration_wholesale_minor,
      fxRateMicros,
      marginBasisPoints: 1000,
      minimumMarginZmwMinor: DEFAULT_MINIMUM_MARGIN_ZMW_MINOR,
    })
    const renewal = calculateRetailPrice({
      wholesaleMinor: row.renewal_wholesale_minor,
      fxRateMicros,
      marginBasisPoints: 1000,
      minimumMarginZmwMinor: DEFAULT_MINIMUM_MARGIN_ZMW_MINOR,
    })
    const pricingSource = `BOZ-mid:${rate.rateDate}:${rate.midRate.toFixed(4)};buf=1;mk=1000bp;floor=2500`
    const snapshot = {
      tld: row.tld,
      provider_id: row.provider_id,
      wholesale_currency: "USD",
      registration_wholesale_minor: row.registration_wholesale_minor,
      renewal_wholesale_minor: row.renewal_wholesale_minor,
      fx_rate_micros: fxRateMicros,
      margin_basis_points: 1000,
      minimum_margin_zmw_minor: DEFAULT_MINIMUM_MARGIN_ZMW_MINOR,
      retail_currency: "ZMW",
      registration_retail_minor: registration.retailZmwMinor,
      renewal_retail_minor: renewal.retailZmwMinor,
      pricing_source: pricingSource,
      recorded_by: null,
    }
    const { error: historyError } = await supabase.from("domain_price_snapshots").insert(snapshot)
    if (historyError) throw new Error(`Could not record the ${row.tld} price history; repricing stopped.`)

    const { error: updateError } = await supabase
      .from("domain_tld_catalog")
      .update({
        wholesale_fx_rate_micros: fxRateMicros,
        margin_basis_points: 1000,
        minimum_margin_zmw_minor: DEFAULT_MINIMUM_MARGIN_ZMW_MINOR,
        registration_retail_minor: registration.retailZmwMinor,
        renewal_retail_minor: renewal.retailZmwMinor,
        pricing_source: pricingSource,
        price_updated_at: now,
      })
      .eq("tld", row.tld)
    if (updateError) throw new Error(`Could not update ${row.tld}; repricing stopped.`)
    updated.push(row.tld)
  }

  return {
    provider: "Bank of Zambia",
    rateDate: rate.rateDate,
    midRate: rate.midRate,
    bufferZmw: BOZ_FX_BUFFER_ZMW,
    effectiveRate,
    fxRateMicros,
    updatedTlds: updated,
    skippedTlds: skipped,
    refreshedAt: now,
  }
}
