import { NextResponse } from "next/server"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

export const dynamic = "force-dynamic"

const schema = z.object({
  orderId: z.string().uuid(),
  providerId: z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/),
  providerOrderReference: z.string().trim().max(200).optional(),
  providerDomainReference: z.string().trim().min(3).max(253),
  registeredAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  availabilityRechecked: z.literal(true),
  priceRechecked: z.literal(true),
  adminNote: z.string().trim().max(500).optional(),
}).strict()

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return json({ error: "Complete the registration details and confirm the required pre-registration checks." }, 400)

  try {
    const authClient = createClient()
    const { data: { user }, error: userError } = await authClient.auth.getUser()
    if (userError || !user) return json({ error: "Authentication required." }, 401)
    const { data: role, error: roleError } = await authClient.rpc("get_user_role", { user_id: user.id })
    if (roleError) return json({ error: "Unable to verify administrator access." }, 503)
    if (role !== "admin") return json({ error: "Administrator access required." }, 403)

    const db = createServiceClient() as unknown as SupabaseClient
    const { data, error } = await db.rpc("record_domain_manual_registration", {
      p_order_id: parsed.data.orderId,
      p_admin_user_id: user.id,
      p_provider_id: parsed.data.providerId,
      p_provider_order_reference: parsed.data.providerOrderReference?.trim() || null,
      p_provider_domain_reference: parsed.data.providerDomainReference.trim().toLowerCase(),
      p_registered_at: parsed.data.registeredAt,
      p_expires_at: parsed.data.expiresAt,
      p_availability_rechecked: parsed.data.availabilityRechecked,
      p_price_rechecked: parsed.data.priceRechecked,
      p_admin_note: parsed.data.adminNote?.trim() || null,
    })
    if (error) {
      if (error.code === "42501") return json({ error: "Administrator access required." }, 403)
      if (error.code === "P0002") return json({ error: "Domain order not found." }, 404)
      if (error.code === "23514" || error.code === "22023") return json({ error: "Registration could not be recorded. Check the payment, order state, provider references, expiry, and confirmations." }, 409)
      throw error
    }
    return json({ result: Array.isArray(data) ? data[0] : data })
  } catch (error) {
    console.error("Manual domain fulfillment failed:", error instanceof Error ? error.name : "unknown")
    return json({ error: "Unable to record the registration at this time." }, 503)
  }
}
