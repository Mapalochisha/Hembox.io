import { NextResponse } from "next/server"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { calculateRetailPrice } from "@/lib/domains/pricing"

export const dynamic = "force-dynamic"

const catalogSchema = z.object({
  tld: z.string().trim().toLowerCase().regex(/^\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/),
  providerId: z.string().trim().min(1).max(80),
  wholesaleCurrency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  registrationWholesaleMinor: z.number().int().nonnegative().safe(),
  renewalWholesaleMinor: z.number().int().nonnegative().safe(),
  fxRateMicros: z.number().int().positive().safe(),
  marginBasisPoints: z.number().int().min(0).max(100000),
  pricingSource: z.string().trim().min(1).max(160),
  enabled: z.boolean(),
})

async function getAdminId() {
  const authClient = createClient()
  const { data: { user }, error: userError } = await authClient.auth.getUser()
  if (userError || !user) return { userId: null, status: 401 as const }

  const { data: role, error: roleError } = await authClient.rpc("get_user_role", { user_id: user.id })
  if (roleError) return { userId: null, status: 503 as const }
  if (role !== "admin") return { userId: null, status: 403 as const }

  return { userId: user.id, status: 200 as const }
}

function errorResponse(status: number) {
  const message = status === 401
    ? "Authentication required."
    : status === 403
      ? "Administrator access required."
      : "Unable to verify administrator access."
  return NextResponse.json({ error: message }, { status })
}

export async function GET() {
  try {
    const auth = await getAdminId()
    if (auth.status !== 200) return errorResponse(auth.status)

    const supabase = createServiceClient() as unknown as SupabaseClient
    const { data, error } = await supabase
      .from("domain_tld_catalog")
      .select("*")
      .order("tld", { ascending: true })

    if (error) throw error
    return NextResponse.json({ catalog: data ?? [] })
  } catch (error) {
    console.error("Admin domain catalogue read failed:", error)
    return NextResponse.json({ error: "Unable to load the domain catalogue." }, { status: 503 })
  }
}

export async function POST(request: Request) {
  let auth: Awaited<ReturnType<typeof getAdminId>>
  try {
    auth = await getAdminId()
  } catch {
    return errorResponse(503)
  }
  if (auth.status !== 200) return errorResponse(auth.status)

  const body = await request.json().catch(() => null)
  const parsed = catalogSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid catalogue entry.", details: parsed.error.flatten() }, { status: 400 })
  }

  const value = parsed.data
  let registration: ReturnType<typeof calculateRetailPrice>
  let renewal: ReturnType<typeof calculateRetailPrice>
  try {
    registration = calculateRetailPrice({
      wholesaleMinor: value.registrationWholesaleMinor,
      fxRateMicros: value.fxRateMicros,
      marginBasisPoints: value.marginBasisPoints,
    })
    renewal = calculateRetailPrice({
      wholesaleMinor: value.renewalWholesaleMinor,
      fxRateMicros: value.fxRateMicros,
      marginBasisPoints: value.marginBasisPoints,
    })
  } catch {
    return NextResponse.json({ error: "Pricing inputs are outside the supported range." }, { status: 400 })
  }

  const priceUpdatedAt = new Date().toISOString()

  try {
    const supabase = createServiceClient() as unknown as SupabaseClient
    // Keep the row disabled until its immutable pricing history record succeeds.
    const { error: upsertError } = await supabase
      .from("domain_tld_catalog")
      .upsert({
        tld: value.tld,
        provider_id: value.providerId,
        wholesale_currency: value.wholesaleCurrency,
        registration_wholesale_minor: value.registrationWholesaleMinor,
        renewal_wholesale_minor: value.renewalWholesaleMinor,
        wholesale_fx_rate_micros: value.fxRateMicros,
        margin_basis_points: value.marginBasisPoints,
        pricing_source: value.pricingSource,
        retail_currency: "ZMW",
        registration_retail_minor: registration.retailZmwMinor,
        renewal_retail_minor: renewal.retailZmwMinor,
        price_updated_at: priceUpdatedAt,
        enabled: false,
      }, { onConflict: "tld" })

    if (upsertError) throw upsertError

    const { error: snapshotError } = await supabase
      .from("domain_price_snapshots")
      .insert({
        tld: value.tld,
        provider_id: value.providerId,
        wholesale_currency: value.wholesaleCurrency,
        registration_wholesale_minor: value.registrationWholesaleMinor,
        renewal_wholesale_minor: value.renewalWholesaleMinor,
        fx_rate_micros: value.fxRateMicros,
        margin_basis_points: value.marginBasisPoints,
        retail_currency: "ZMW",
        registration_retail_minor: registration.retailZmwMinor,
        renewal_retail_minor: renewal.retailZmwMinor,
        pricing_source: value.pricingSource,
        recorded_by: auth.userId,
      })

    if (snapshotError) {
      console.error("Domain catalogue saved disabled because price-history recording failed:", snapshotError)
      return NextResponse.json({ error: "Price history could not be recorded; the TLD remains disabled." }, { status: 503 })
    }

    const { data, error: enableError } = await supabase
      .from("domain_tld_catalog")
      .update({ enabled: value.enabled })
      .eq("tld", value.tld)
      .select("*")
      .single()

    if (enableError) throw enableError
    return NextResponse.json({ catalog: data })
  } catch (error) {
    console.error("Admin domain catalogue update failed:", error)
    return NextResponse.json({ error: "Unable to save the domain catalogue." }, { status: 503 })
  }
}
