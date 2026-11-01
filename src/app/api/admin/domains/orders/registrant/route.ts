import { NextResponse } from "next/server"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

export const dynamic = "force-dynamic"

const detailColumns = "order_id,customer_id,registrant_type,first_name,last_name,organisation_name,email,phone,address_line1,address_line2,city,region,postal_code,country_code,consent_version,consent_accepted_at,updated_at"

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })
}

async function requireAdmin() {
  const authClient = createClient()
  const { data: { user }, error: userError } = await authClient.auth.getUser()
  if (userError || !user) return { status: 401 as const }
  const { data: role, error: roleError } = await authClient.rpc("get_user_role", { user_id: user.id })
  if (roleError) return { status: 503 as const }
  if (role !== "admin") return { status: 403 as const }
  return { status: 200 as const }
}

/**
 * Read-only registrant details for one order, so an administrator can complete
 * the registration in the registrar's console. This surfaces personal data, so
 * it is admin-only, single-order scoped and never cached.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.status !== 200) {
      const message = auth.status === 401 ? "Authentication required."
        : auth.status === 403 ? "Administrator access required."
        : "Unable to verify administrator access."
      return json({ error: message }, auth.status)
    }

    const orderId = new URL(request.url).searchParams.get("orderId")
    if (!orderId || !z.string().uuid().safeParse(orderId).success) {
      return json({ error: "Provide a valid order id." }, 400)
    }

    const db = createServiceClient() as unknown as SupabaseClient
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
    console.error("Admin domain registrant details read failed:", error instanceof Error ? error.name : "unknown")
    return json({ error: "Registrant details are temporarily unavailable." }, 503)
  }
}
