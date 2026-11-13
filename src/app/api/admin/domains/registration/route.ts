import { NextResponse } from "next/server"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })

const schema = z.object({
  orderId: z.string().uuid(),
  providerId: z.string().trim().min(1).max(80),
  providerOrderReference: z.string().trim().max(200).optional().default(""),
  providerDomainReference: z.string().trim().min(3).max(253),
  registeredAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  availabilityRechecked: z.boolean().default(false),
  priceRechecked: z.boolean().default(false),
  adminNote: z.string().trim().max(500).optional().default(""),
}).strict()

async function requireAdmin() {
  const authClient = await createClient()
  const { data: { user }, error: userError } = await authClient.auth.getUser()
  if (userError || !user) return { status: 401 as const }
  const { data: role, error: roleError } = await authClient.rpc("get_user_role", { user_id: user.id })
  if (roleError) return { status: 503 as const }
  if (role !== "admin") return { status: 403 as const }
  return { status: 200 as const, userId: user.id }
}

function authError(status: 401 | 403 | 503) {
  return json({
    error: status === 401 ? "Authentication required."
      : status === 403 ? "Administrator access required."
        : "Unable to verify administrator access.",
  }, status)
}

/**
 * Record a domain registration that an administrator completed externally at the
 * registrar. This route never calls the registrar API; it persists the real
 * provider references, dates and evidence after the admin has confirmed them
 * out-of-band. Payment evidence (verified legacy claim or fully paid billing
 * invoice) and registrant details are enforced by the database function.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (auth.status !== 200) return authError(auth.status)

  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return json({ error: "Provide valid registration evidence." }, 400)
  }

  const input = parsed.data
  const registeredAt = new Date(input.registeredAt)
  const expiresAt = new Date(input.expiresAt)
  const now = new Date()

  if (!Number.isFinite(registeredAt.getTime()) || registeredAt > now) {
    return json({ error: "Registered at must be a valid past or current timestamp." }, 400)
  }
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= registeredAt || expiresAt <= now) {
    return json({ error: "Expires at must be after the registration date and in the future." }, 400)
  }
  if (!input.availabilityRechecked || !input.priceRechecked) {
    return json({ error: "Availability and final price must be rechecked before recording a registration." }, 409)
  }

  const db = createServiceClient() as unknown as SupabaseClient
  try {
    const { data, error } = await db.rpc("record_domain_manual_registration", {
      p_order_id: input.orderId,
      p_admin_user_id: auth.userId,
      p_provider_id: input.providerId,
      p_provider_order_reference: input.providerOrderReference || null,
      p_provider_domain_reference: input.providerDomainReference.toLowerCase(),
      p_registered_at: registeredAt.toISOString(),
      p_expires_at: expiresAt.toISOString(),
      p_availability_rechecked: input.availabilityRechecked,
      p_price_rechecked: input.priceRechecked,
      p_admin_note: input.adminNote || null,
    })

    if (error) {
      if (error.code === "42501") return json({ error: "Administrator access required." }, 403)
      if (error.code === "P0002") return json({ error: "Domain order not found." }, 404)
      if (error.code === "23514" || error.code === "22023") {
        return json({ error: "Registration cannot be recorded: " + error.message }, 409)
      }
      throw error
    }

    const row = Array.isArray(data) ? data[0] : data
    return json({
      orderId: row?.order_id,
      orderStatus: row?.order_status,
      alreadyRecorded: row?.already_recorded === true,
      paymentEvidence: row?.payment_evidence ?? null,
    }, row?.already_recorded === true ? 200 : 201)
  } catch (error) {
    console.error("Admin manual domain registration failed:", error instanceof Error ? error.name : "unknown")
    return json({ error: "The registration record could not be saved. Check the order and evidence before retrying." }, 503)
  }
}
