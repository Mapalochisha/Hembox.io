import { NextResponse } from "next/server"
import { z } from "zod"
import { createServiceClient } from "@/lib/supabase/service"

const inquirySchema = z.object({
  type: z.enum(["mockup", "quote", "pricing", "contact"]),
  email: z.string().trim().email().max(254),
  website: z.string().trim().max(500).optional().default(""),
  message: z.string().trim().max(2000).optional().default(""),
  name: z.string().trim().max(120).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  source: z.string().trim().max(120).optional().default("website"),
  honeypot: z.string().optional().default(""),
})

const attempts = new Map<string, { count: number; resetAt: number }>()
const WINDOW_MS = 60_000
const MAX_ATTEMPTS = 8

function getClientKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
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

    if (!parsed.success) {
      return NextResponse.json({ error: "Please provide a valid email and request details." }, { status: 400 })
    }

    // Silent success for bots without creating a lead.
    if (parsed.data.honeypot) {
      return NextResponse.json({ success: true })
    }

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("inquiries")
      .insert({
        type: parsed.data.type,
        email: parsed.data.email,
        name: parsed.data.name || null,
        phone: parsed.data.phone || null,
        website: parsed.data.website || null,
        message: parsed.data.message || null,
        source: parsed.data.source || "website",
      })
      .select("id")
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, id: data.id }, { status: 201 })
  } catch (error) {
    console.error("Inquiry submission error:", error)
    return NextResponse.json({ error: "Unable to send your request right now. Please try again." }, { status: 500 })
  }
}
