import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

export const dynamic = "force-dynamic"

const SAMPLE_LIMIT = 500
const FX_SCALE = 1_000_000

type QuoteMarginRow = {
  id: string
  order_id: string
  domain_name: string
  currency: string
  registration_price_minor: number
  renewal_price_minor: number
  registration_wholesale_minor: number | null
  renewal_wholesale_minor: number | null
  wholesale_currency: string | null
  fx_rate_micros: number | null
  margin_basis_points: number | null
  pricing_source: string
  pricing_captured_at: string
  created_at: string
  expires_at: string
}

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  })
}

async function requireAdmin() {
  const authClient = createClient()
  const { data: { user }, error: userError } = await authClient.auth.getUser()
  if (userError || !user) return 401 as const

  const { data: role, error: roleError } = await authClient.rpc("get_user_role", { user_id: user.id })
  if (roleError) return 503 as const
  if (role !== "admin") return 403 as const
  return 200 as const
}

function nonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}

function positiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
}

function estimateMargin(retailMinor: number, wholesaleMinor: number, fxRateMicros: number) {
  const convertedWholesale = Math.ceil((wholesaleMinor * fxRateMicros) / FX_SCALE)
  if (!Number.isSafeInteger(convertedWholesale)) return null
  const marginMinor = retailMinor - convertedWholesale
  return Number.isSafeInteger(marginMinor) ? { convertedWholesaleMinor: convertedWholesale, marginMinor } : null
}

/**
 * This is an indicative report of the most recent saved quote snapshots, not
 * accounting profit. It excludes payment fees, taxes, refunds and operating
 * costs, and never substitutes current catalogue values for captured inputs.
 */
export async function GET() {
  try {
    const authStatus = await requireAdmin()
    if (authStatus !== 200) {
      const message = authStatus === 401 ? "Authentication required."
        : authStatus === 403 ? "Administrator access required."
        : "Unable to verify administrator access."
      return response({ error: message }, authStatus)
    }

    const db = createServiceClient() as unknown as SupabaseClient
    const { data, error } = await db
      .from("domain_order_quotes")
      .select("id,order_id,domain_name,currency,registration_price_minor,renewal_price_minor,registration_wholesale_minor,renewal_wholesale_minor,wholesale_currency,fx_rate_micros,margin_basis_points,pricing_source,pricing_captured_at,created_at,expires_at")
      .order("created_at", { ascending: false })
      .limit(SAMPLE_LIMIT)

    if (error) throw error

    const rows = (data ?? []) as QuoteMarginRow[]
    let completeSnapshots = 0
    let incompleteSnapshots = 0
    let registrationRetailMinor = 0
    let renewalRetailMinor = 0
    let registrationWholesaleZmwMinor = 0
    let renewalWholesaleZmwMinor = 0
    let registrationMarginMinor = 0
    let renewalMarginMinor = 0
    let marginRows = 0
    let expiredQuotes = 0
    let futureQuotes = 0
    const now = Date.now()

    for (const row of rows) {
      const hasInputs =
        nonNegativeSafeInteger(row.registration_wholesale_minor) &&
        nonNegativeSafeInteger(row.renewal_wholesale_minor) &&
        positiveSafeInteger(row.fx_rate_micros) &&
        typeof row.wholesale_currency === "string" &&
        /^[A-Z]{3}$/.test(row.wholesale_currency) &&
        row.currency === "ZMW" &&
        Number.isSafeInteger(row.registration_price_minor) &&
        row.registration_price_minor >= 0 &&
        Number.isSafeInteger(row.renewal_price_minor) &&
        row.renewal_price_minor >= 0

      if (!hasInputs) {
        incompleteSnapshots += 1
        continue
      }

      const registration = estimateMargin(
        row.registration_price_minor,
        row.registration_wholesale_minor!,
        row.fx_rate_micros!,
      )
      const renewal = estimateMargin(
        row.renewal_price_minor,
        row.renewal_wholesale_minor!,
        row.fx_rate_micros!,
      )
      if (!registration || !renewal) {
        incompleteSnapshots += 1
        continue
      }

      completeSnapshots += 1
      marginRows += 1
      registrationRetailMinor += row.registration_price_minor
      renewalRetailMinor += row.renewal_price_minor
      registrationWholesaleZmwMinor += registration.convertedWholesaleMinor
      renewalWholesaleZmwMinor += renewal.convertedWholesaleMinor
      registrationMarginMinor += registration.marginMinor
      renewalMarginMinor += renewal.marginMinor

      const expiresAt = Date.parse(row.expires_at)
      if (Number.isFinite(expiresAt) && expiresAt <= now) expiredQuotes += 1
      else if (Number.isFinite(expiresAt) && expiresAt > now) futureQuotes += 1
    }

    return response({
      generatedAt: new Date(now).toISOString(),
      scope: "latest_saved_quotes",
      sampleLimit: SAMPLE_LIMIT,
      sampledQuotes: rows.length,
      hasMorePotentialRecords: rows.length === SAMPLE_LIMIT,
      completeSnapshots,
      incompleteSnapshots,
      quotes: { expired: expiredQuotes, unexpired: futureQuotes },
      currency: "ZMW",
      estimates: {
        registration: {
          retailMinor: registrationRetailMinor,
          wholesaleZmwMinor: registrationWholesaleZmwMinor,
          grossMarginMinor: registrationMarginMinor,
        },
        renewal: {
          retailMinor: renewalRetailMinor,
          wholesaleZmwMinor: renewalWholesaleZmwMinor,
          grossMarginMinor: renewalMarginMinor,
        },
        combinedGrossMarginMinor: registrationMarginMinor + renewalMarginMinor,
      },
      note: "Indicative margin across saved quote snapshots, not realized revenue or accounting profit. Excludes gateway fees, taxes, refunds, chargebacks, FX movement after quote capture and operating costs. Wholesale amounts are converted using each quote's captured FX input and rounded up to the next minor unit.",
    })
  } catch (error) {
    console.error("Admin domain margin report failed:", error instanceof Error ? error.name : "unknown_error")
    return response({ error: "Margin reporting is temporarily unavailable." }, 503)
  }
}
