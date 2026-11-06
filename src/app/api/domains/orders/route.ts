import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

    // Session-bound client plus RLS: never use the service role for customer reads.
    const db = supabase as unknown as SupabaseClient
    const { data, error } = await db
      .from("domain_orders")
      .select("id,domain_name,status,retail_currency,registration_retail_minor,renewal_retail_minor,quote_expires_at,registered_at,expires_at,created_at,updated_at")
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100)

    if (error) throw error
    const orderIds = (data ?? []).map((order) => order.id)
    let paymentClaims: unknown[] = []
    if (orderIds.length) {
      const { data: claims, error: claimsError } = await db
        .from("domain_manual_payment_claims")
        .select("id,order_id,payment_reference,transaction_reference,amount_minor,currency,status,review_note,created_at,updated_at")
        .eq("customer_id", user.id)
        .in("order_id", orderIds)
        .order("created_at", { ascending: false })
        .limit(100)
      if (claimsError) throw claimsError
      paymentClaims = claims ?? []
    }

    // Registrant details are read through the same owner-scoped client; a
    // missing migration degrades to "not captured yet" instead of failing.
    const registrantDetails: unknown[] = []
    let registrantDetailsAvailable = true
    if (orderIds.length) {
      const { data: details, error: detailsError } = await db
        .from("domain_order_registrant_details")
        .select("order_id,registrant_type,first_name,last_name,organisation_name,email,phone,address_line1,address_line2,city,region,postal_code,country_code,consent_version,consent_accepted_at,updated_at")
        .in("order_id", orderIds)
      if (detailsError) {
        if (detailsError.code === "42P01" || detailsError.code === "PGRST205") {
          registrantDetailsAvailable = false
        } else {
          throw detailsError
        }
      } else {
        registrantDetails.push(...(details ?? []))
      }
    }

    return NextResponse.json(
      { orders: data ?? [], paymentClaims, registrantDetails, registrantDetailsAvailable },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    console.error("Customer domain orders read failed:", error)
    return NextResponse.json(
      { error: "Domain orders are temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }
}
