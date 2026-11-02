import { NextResponse } from "next/server"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { createNameSiloSandboxOperations } from "@/lib/domains/providers/namesilo-sandbox-operations"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const schema = z.object({
  domainName: z.string().trim().toLowerCase().min(3).max(253),
  termYears: z.number().int().min(1).max(10),
  idempotencyKey: z.string().trim().min(8).max(120).regex(/^[A-Za-z0-9._:-]+$/),
  registrant: z.object({
    firstName: z.string().trim().min(1).max(32),
    lastName: z.string().trim().min(1).max(32),
    organisationName: z.string().trim().max(64).optional(),
    email: z.string().trim().email().max(128),
    phone: z.string().trim().transform((value) => value.replace(/[\s()-]/g, "")).pipe(z.string().regex(/^\+260[0-9]{9}$/)),
    addressLine1: z.string().trim().min(3).max(128),
    addressLine2: z.string().trim().max(128).optional(),
    city: z.string().trim().min(2).max(64),
    region: z.string().trim().min(2).max(64),
    postalCode: z.string().trim().min(1).max(16),
    countryCode: z.literal("ZM"),
    consentAccepted: z.literal(true),
  }).strict(),
}).strict()

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })
}
function sandboxEnabled() {
  return process.env.DOMAIN_PROVIDER_MODE?.trim().toLowerCase() === "namesilo-sandbox"
}

async function customer() {
  const auth = createClient()
  const { data: { user }, error } = await auth.auth.getUser()
  if (error || !user) return null
  return user
}

export async function GET() {
  if (!sandboxEnabled()) return json({ error: "Sandbox domain journeys are not enabled." }, 404)
  const user = await customer()
  if (!user) return json({ error: "Sign in to view your sandbox domains." }, 401)
  try {
    const db = createServiceClient() as unknown as SupabaseClient
    const { data, error } = await db.from("domain_sandbox_orders")
      .select("id,domain_name,term_years,status,payment_mode,payment_status,test_payment_reference,test_payment_submitted_at,test_payment_reviewed_at,provider_environment,registered_at,expires_at,nameservers,last_provider_check_at,last_provider_message,created_at")
      .eq("customer_id", user.id).order("created_at", { ascending: false }).limit(50)
    if (error) throw error
    return json({ orders: data ?? [] })
  } catch {
    return json({ error: "Sandbox domain orders are unavailable. The sandbox migration may not be deployed yet." }, 503)
  }
}

export async function POST(request: Request) {
  if (!sandboxEnabled()) return json({ error: "Sandbox domain journeys are not enabled." }, 404)
  const user = await customer()
  if (!user) return json({ error: "Sign in before starting a sandbox purchase." }, 401)

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: "Complete the domain, term and Zambia-based registrant details, then accept the sandbox consent." }, 400)

  const domainName = parsed.data.domainName
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(domainName) ||
      ![".com", ".net"].some((suffix) => domainName.endsWith(suffix))) {
    return json({ error: "NameSilo OTE checkout currently supports .com and .net test domains only." }, 400)
  }

  try {
    const operations = createNameSiloSandboxOperations()
    const availability = await operations.checkAvailability([domainName])
    if (availability[0]?.availability !== "available") {
      return json({ error: availability[0]?.message ?? "NameSilo OTE did not confirm this domain as available.", availability: availability[0] }, 409)
    }

    const db = createServiceClient() as unknown as SupabaseClient
    const { data: existing, error: existingError } = await db.from("domain_sandbox_orders")
      .select("id,domain_name,status,payment_status")
      .eq("customer_id", user.id).eq("idempotency_key", parsed.data.idempotencyKey).maybeSingle()
    if (existingError) throw existingError
    if (existing) {
      if (existing.domain_name !== domainName) return json({ error: "This request key has already been used for another domain." }, 409)
      return json({ order: existing, replay: true })
    }

    const registrant = parsed.data.registrant
    const { data, error } = await db.from("domain_sandbox_orders").insert({
      customer_id: user.id,
      domain_name: domainName,
      term_years: parsed.data.termYears,
      status: "quoted",
      payment_mode: "sandbox_simulated",
      payment_status: "not_started",
      provider_id: "namesilo",
      provider_environment: "test",
      registrant_details: {
        firstName: registrant.firstName,
        lastName: registrant.lastName,
        organisationName: registrant.organisationName ?? null,
        email: registrant.email,
        phone: registrant.phone,
        addressLine1: registrant.addressLine1,
        addressLine2: registrant.addressLine2 ?? null,
        city: registrant.city,
        region: registrant.region,
        postalCode: registrant.postalCode,
        countryCode: "ZM",
        consentAcceptedAt: new Date().toISOString(),
        consentVersion: "namesilo-ote-registrant-v1",
      },
      idempotency_key: parsed.data.idempotencyKey,
      last_provider_check_at: new Date().toISOString(),
      last_provider_message: availability[0].message,
    }).select("id,domain_name,term_years,status,payment_mode,payment_status,test_payment_reference,test_payment_submitted_at,provider_environment,created_at").single()
    if (error) throw error

    const { error: eventError } = await db.from("domain_sandbox_events").insert({
      order_id: data.id, actor_user_id: user.id, event_type: "order_created",
      details: { domain_name: domainName, term_years: parsed.data.termYears, provider: "namesilo", environment: "test", availability: "available_at_check" },
    })
    if (eventError) {
      await db.from("domain_sandbox_orders").delete().eq("id", data.id).eq("customer_id", user.id)
      throw eventError
    }
    return json({ order: data, replay: false }, 201)
  } catch (error) {
    console.error("Sandbox domain order creation failed:", error instanceof Error ? error.name : "unknown")
    return json({ error: "The sandbox order could not be saved. No payment or registration was attempted." }, 503)
  }
}
