import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { isPricingSnapshotFresh } from "@/lib/domains/pricing"

export const dynamic = "force-dynamic"

const MAX_PRICE_AGE_MS = 24 * 60 * 60 * 1000

type CatalogRow = {
  tld: string
  retail_currency: string
  registration_retail_minor: number | null
  renewal_retail_minor: number | null
  price_updated_at: string | null
}

export async function GET() {
  try {
    const supabase = createServiceClient()
    const db = supabase as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (column: string, value: boolean) => {
            order: (column: string, options: { ascending: boolean }) => Promise<{
              data: CatalogRow[] | null
              error: { message: string } | null
            }>
          }
        }
      }
    }

    const { data, error } = await db
      .from("domain_tld_catalog")
      .select("tld,retail_currency,registration_retail_minor,renewal_retail_minor,price_updated_at,enabled")
      .eq("enabled", true)
      .order("tld", { ascending: true })

    if (error) throw error

    const now = Date.now()
    const catalog = (data ?? []).map((row) => {
      const fresh = isPricingSnapshotFresh(row.price_updated_at, now, MAX_PRICE_AGE_MS)
      const hasPrices = row.registration_retail_minor !== null && row.renewal_retail_minor !== null
      const publishable = fresh && hasPrices && row.retail_currency === "ZMW"

      return {
        tld: row.tld,
        currency: "ZMW",
        pricingStatus: publishable ? "current" : "price_unavailable",
        registrationPriceMinor: publishable ? row.registration_retail_minor : null,
        renewalPriceMinor: publishable ? row.renewal_retail_minor : null,
        priceUpdatedAt: publishable ? row.price_updated_at : null,
      }
    })

    return NextResponse.json({ currency: "ZMW", catalog, availabilityChecked: false })
  } catch (error) {
    console.error("Domain catalogue read failed:", error)
    return NextResponse.json(
      { error: "Domain pricing is temporarily unavailable.", catalog: [] },
      { status: 503 },
    )
  }
}
