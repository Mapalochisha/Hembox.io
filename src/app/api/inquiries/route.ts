import { NextResponse } from "next/server"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceClient } from "@/lib/supabase/service"
import { createClient as createAuthClient } from "@/lib/supabase/server"
import { parseDomainSearchRequest } from "@/lib/domains/validation"

// This handler depends on Supabase at request time. Never attempt to
// prerender/evaluate it as a static route during the Vercel build.
export const dynamic = "force-dynamic"

const inquirySchema = z.object({
  type: z.enum(["mockup", "quote", "pricing", "contact"]),
  contact: z.string().trim().min(3).max(254),
  message: z.string().trim().min(1).max(2000),
  name: z.string().trim().max(120).optional().default(""),
  product: z.string().trim().max(120).optional(),
  service: z.string().trim().max(120).optional(),
  source: z.string().trim().max(120).optional().default("website"),
  domain: z.string().trim().max(253).optional(),
  idempotencyKey: z.string().uuid().optional(),
  honeypot: z.string().optional().default(""),
})

const attempts = new Map<string, { count: number; resetAt: number }>()
const WINDOW_MS = 60_000
const MAX_ATTEMPTS = 8

function getClientKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
}

function isEmail(value: string) {
  return z.string().email().safeParse(value).success
}

function isPhone(value: string) {
  const digits = value.replace(/\D/g, "")
  return digits.length >= 7 && digits.length <= 15 && /^[+\d\s().-]+$/.test(value)
}

export async function POST(request: Request) {
  try {
    const key = getClientKey(request)
    const now = Date.now()
    const current = attempts.get(key)

    if (!current || current.resetAt <= now) {
      attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    } else if (current.count >= MAX_ATTEMPTS) {
      return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 })
    } else {
      current.count += 1
    }

    const body = await request.json()
    const parsed = inquirySchema.safeParse(body)

    if (!parsed.success || (!isEmail(parsed.data.contact) && !isPhone(parsed.data.contact))) {
      return NextResponse.json({ error: "Please provide a valid email or WhatsApp number and a message." }, { status: 400 })
    }

    if (parsed.data.honeypot) {
      return NextResponse.json({ success: true })
    }

    const contactIsEmail = isEmail(parsed.data.contact)
    const contextLines = [
      parsed.data.product ? `Selected plan: ${parsed.data.product}` : null,
      parsed.data.service ? `Selected service: ${parsed.data.service}` : null,
    ].filter(Boolean)
    const storedMessage = contextLines.length > 0
      ? `${contextLines.join("\n")}\n\nMessage:\n${parsed.data.message}`
      : parsed.data.message

    const supabase = createServiceClient()
    const inquiry = {
      type: parsed.data.type,
      contact: parsed.data.contact,
      email: contactIsEmail ? parsed.data.contact : null,
      name: parsed.data.name || null,
      phone: contactIsEmail ? null : parsed.data.contact,
      website: null,
      message: storedMessage,
      source: parsed.data.source || "website",
    }

    const { data, error } = await supabase
      .from("inquiries")
      .insert(inquiry as never)
      .select("id")
      .single()

    if (error) throw error

    const inserted = data as { id: string }

    // Domain enquiries also get a durable order record when the domain schema
    // is deployed. This is best-effort so a pending migration never breaks the
    // established public inquiry form. The order remains enquiry-only.
    if (parsed.data.source === "domain-storefront" && parsed.data.domain) {
      const parsedDomain = parseDomainSearchRequest({ domains: [parsed.data.domain] })
      if (parsedDomain.success && parsedDomain.data.domains.length === 1) {
        try {
          let customerId: string | null = null
          try {
            const authClient = createAuthClient()
            const { data: { user } } = await authClient.auth.getUser()
            customerId = user?.id ?? null
          } catch {
            // Guest enquiries are valid; no account association is inferred.
          }

          const domainDb = supabase as unknown as SupabaseClient
          const { error: orderError } = await domainDb
            .from("domain_orders")
            .upsert({
              customer_id: customerId,
              customer_email: contactIsEmail ? parsed.data.contact : null,
              customer_contact: parsed.data.contact,
              customer_name: parsed.data.name || null,
              domain_name: parsedDomain.data.domains[0],
              status: "enquiry",
              idempotency_key: parsed.data.idempotencyKey || inserted.id,
            }, { onConflict: "idempotency_key", ignoreDuplicates: true })

          if (orderError) throw orderError
        } catch (orderError) {
          console.warn("Inquiry saved, but the durable domain order could not be created:", orderError)
        }
      }
    }

    // The inquiry remains the source of truth, so a missing messaging migration
    // must not break the public inquiry form. Once the migration is applied,
    // every new inquiry is automatically represented as the first message.
    const { error: messageError } = await supabase
      .from("inquiry_messages")
      .insert({
        inquiry_id: inserted.id,
        sender_role: "customer",
        sender_id: null,
        body: parsed.data.message,
      } as never)

    if (messageError) {
      console.warn("Inquiry saved but thread seed was unavailable:", messageError.message)
    }

    return NextResponse.json({ success: true, id: inserted.id }, { status: 201 })
  } catch (error) {
    console.error("Inquiry submission error:", error)
    return NextResponse.json({ error: "Unable to send your request right now. Please try again." }, { status: 500 })
  }
}
