import { NextResponse } from "next/server"
import { z } from "zod"
import { createServiceClient } from "@/lib/supabase/service"

const inquirySchema = z.object({
  type: z.enum(["mockup", "quote", "pricing", "contact"]),
  contact: z.string().trim().min(3).max(254),
  message: z.string().trim().min(1).max(2000),
  name: z.string().trim().max(120).optional().default(""),
  product: z.string().trim().max(120).optional(),
  service: z.string().trim().max(120).optional(),
  source: z.string().trim().max(120).optional().default("website"),
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
    return NextResponse.json({ success: true, id: inserted.id }, { status: 201 })
  } catch (error) {
    console.error("Inquiry submission error:", error)
    return NextResponse.json({ error: "Unable to send your request right now. Please try again." }, { status: 500 })
  }
}
