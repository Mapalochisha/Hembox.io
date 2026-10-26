import { NextResponse } from "next/server"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient as createAuthClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

export const dynamic = "force-dynamic"
const schema = z.object({
  category: z.string().trim().min(2).max(120),
  service: z.string().trim().min(2).max(160),
  brief: z.string().trim().min(10).max(4000),
  timing: z.enum(["flexible", "within_month", "urgent"]).default("flexible"),
  budget: z.string().trim().max(120).optional().default(""),
  budgetCurrency: z.enum(["ZMW","USD"]).default("ZMW"),
  reference: z.string().trim().max(1000).optional().default(""),
}).strict()
function json(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }) }

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return json({ error: "Complete the service type and provide a short project brief." }, 400)
  try {
    const auth = createAuthClient()
    const { data: { user }, error: authError } = await auth.auth.getUser()
    if (authError || !user || !user.email) return json({ error: "Sign in with an email address to request a service." }, 401)

    const db: any = createServiceClient()
    const message = [
      "Client portal service request",
      "Category: " + parsed.data.category,
      "Requested service: " + parsed.data.service,
      "Preferred timing: " + ({ flexible: "Flexible", within_month: "Within one month", urgent: "As soon as possible" }[parsed.data.timing]),
      parsed.data.budget ? "Indicative budget (" + parsed.data.budgetCurrency + "): " + parsed.data.budget : null,
      parsed.data.reference ? "References or context: " + parsed.data.reference : null,
      "",
      "Project brief:",
      parsed.data.brief,
    ].filter((line) => line !== null).join("\n")

    const { data: inquiry, error } = await db.from("inquiries").insert({
      type: "quote", email: user.email, contact: user.email,
      name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
      customer_id: user.id, message, source: "client-portal", status: "new",
    }).select("id,created_at").single()
    if (error) throw error

    const { error: messageError } = await db.from("inquiry_messages").insert({
      inquiry_id: inquiry.id, sender_role: "customer", sender_id: user.id,
      body: "Service request submitted.\n\n" + message,
    })
    if (messageError) {
      console.error("[Portal] Request saved but conversation seed failed:", messageError)
    }
    return json({ request: { id: inquiry.id, created_at: inquiry.created_at }, message: "Your request has been sent to HEMBOX. It is awaiting review; no project or quote is confirmed yet." }, 201)
  } catch (error) {
    console.error("[Portal] Service request failed:", error)
    return json({ error: "We could not submit your request right now. Please try again." }, 503)
  }
}
