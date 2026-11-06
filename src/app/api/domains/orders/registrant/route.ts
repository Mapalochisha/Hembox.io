import { NextResponse } from "next/server"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Pinned server-side so a client cannot claim to have accepted a different
// consent text than the one the product actually shows.
const CONSENT_VERSION = "domain-registrant-v1"

const detailColumns = "order_id,customer_id,registrant_type,first_name,last_name,organisation_name,email,phone,address_line1,address_line2,city,region,postal_code,country_code,consent_version,consent_accepted_at,created_at,updated_at"

const saveSchema = z.object({
  orderId: z.string().uuid(),
  registrantType: z.enum(["individual", "organisation"]),
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  organisationName: z.string().trim().max(120).optional(),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().min(7).max(20),
  addressLine1: z.string().trim().min(3).max(120),
  addressLine2: z.string().trim().max(120).optional(),
  city: z.string().trim().min(2).max(80),
  region: z.string().trim().min(2).max(80),
  postalCode: z.string().trim().max(20).optional(),
  countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
  consentAccepted: z.literal(true),
}).strict()

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })
}

function normalisePhone(value: string): string | null {
  const cleaned = value.replace(/[\s()-]/g, "")
  return /^\+[0-9]{7,15}$/.test(cleaned) ? cleaned : null
}

export async function GET(request: Request) {
  try {
    const orderId = new URL(request.url).searchParams.get("orderId")
    if (!orderId || !z.string().uuid().safeParse(orderId).success) {
      return json({ error: "Provide a valid order id." }, 400)
    }

    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) return json({ error: "Sign in to view registrant details." }, 401)

    // Session-bound client plus RLS: the owner policy decides visibility.
    const db = authClient as unknown as SupabaseClient
    const { data, error } = await db
      .from("domain_order_registrant_details")
      .select(detailColumns)
      .eq("order_id", orderId)
      .maybeSingle()

    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205") {
        return json({ details: null, unavailable: true })
      }
      throw error
    }
    return json({ details: data ?? null })
  } catch (error) {
    console.error("Domain registrant details read failed:", error instanceof Error ? error.name : "unknown")
    return json({ error: "Registrant details are temporarily unavailable." }, 503)
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = saveSchema.safeParse(body)
  if (!parsed.success) {
    return json({ error: "Complete the registrant details and accept the registrant consent." }, 400)
  }

  const phone = normalisePhone(parsed.data.phone)
  if (!phone) {
    return json({ error: "Enter a phone number in international format, for example +260970000000." }, 400)
  }
  if (parsed.data.registrantType === "organisation" && !parsed.data.organisationName?.trim()) {
    return json({ error: "An organisation registrant requires an organisation name." }, 400)
  }

  try {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) return json({ error: "Sign in to save registrant details." }, 401)

    const db = createServiceClient() as unknown as SupabaseClient
    const { data: order, error: orderError } = await db
      .from("domain_orders")
      .select("id,customer_id,domain_name,status")
      .eq("id", parsed.data.orderId)
      .eq("customer_id", user.id)
      .maybeSingle()
    if (orderError) throw orderError
    if (!order) return json({ error: "Domain order not found." }, 404)
    if (!["enquiry", "quoted", "awaiting_payment", "payment_confirmed", "manual_review"].includes(order.status)) {
      return json({ error: "Registrant details cannot change once registration has started. Contact support.", code: "order_locked" }, 409)
    }

    const { data, error } = await db.rpc("save_domain_order_registrant_details", {
      p_order_id: order.id,
      p_customer_id: user.id,
      p_registrant_type: parsed.data.registrantType,
      p_first_name: parsed.data.firstName,
      p_last_name: parsed.data.lastName,
      p_organisation_name: parsed.data.organisationName?.trim() || null,
      p_email: parsed.data.email,
      p_phone: phone,
      p_address_line1: parsed.data.addressLine1,
      p_address_line2: parsed.data.addressLine2?.trim() || null,
      p_city: parsed.data.city,
      p_region: parsed.data.region,
      p_postal_code: parsed.data.postalCode?.trim() || null,
      p_country_code: parsed.data.countryCode,
      p_consent_version: CONSENT_VERSION,
    })
    if (error) {
      if (error.code === "42P01" || error.code === "42883") {
        return json({ error: "Registrant details are not available in this environment yet. Contact support.", code: "registrant_details_unavailable" }, 503)
      }
      if (error.code === "42501") return json({ error: "This domain order does not belong to your account." }, 403)
      if (error.code === "23514") return json({ error: "Registrant details cannot be saved for this order in its current state.", code: "order_locked" }, 409)
      if (error.code === "22023") return json({ error: "Some registrant details are invalid. Check every field and try again." }, 400)
      throw error
    }

    const result = Array.isArray(data) ? data[0] : data
    const { data: saved, error: readError } = await db
      .from("domain_order_registrant_details")
      .select(detailColumns)
      .eq("order_id", order.id)
      .maybeSingle()
    if (readError) throw readError

    return json({
      saved: true,
      created: Boolean(result && typeof result === "object" && "created" in result && (result as { created?: boolean }).created),
      details: saved ?? null,
      consentVersion: CONSENT_VERSION,
    }, 200)
  } catch (error) {
    console.error("Domain registrant details save failed:", error instanceof Error ? error.name : "unknown")
    return json({ error: "Registrant details could not be saved. No payment or registration was attempted." }, 503)
  }
}
