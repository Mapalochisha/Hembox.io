import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getNameSiloStandardPrices, resolveNameSiloPriceEnvironment } from "@/lib/domains/providers/namesilo-prices"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex" },
  })
}

async function requireAdmin() {
  const authClient = await createClient()
  const { data: { user }, error: userError } = await authClient.auth.getUser()
  if (userError || !user) return 401 as const
  const { data: role, error: roleError } = await authClient.rpc("get_user_role", { user_id: user.id })
  if (roleError) return 503 as const
  return role === "admin" ? 200 as const : 403 as const
}

/**
 * Read-only NameSilo price retrieval. It intentionally does not persist prices,
 * alter the TLD catalogue, or expose provider credentials.
 */
export async function GET() {
  try {
    const status = await requireAdmin()
    if (status !== 200) {
      return json({ error: status === 401 ? "Authentication required." : status === 403 ? "Administrator access required." : "Unable to verify administrator access." }, status)
    }
    const environment = resolveNameSiloPriceEnvironment()
    const result = await getNameSiloStandardPrices({ environment })
    return json({
      provider: "namesilo",
      environment: result.environment,
      pricingPlan: "standard-pay-as-you-go",
      currency: "USD",
      source: result.source,
      fetchedAt: result.fetchedAt,
      prices: result.prices,
      persisted: false,
      message: result.environment === "test"
        ? "Sandbox (OTE) rates. NameSilo sandbox pricing is not production pricing — use it to rehearse the pricing and markup flow, then repeat the retrieval against the production account before approving any customer price. Nothing has been published."
        : "Read-only provider rates. Review each TLD, verify FX and markup, then enter approved values in the TLD catalogue. Nothing has been published.",
    })
  } catch (error) {
    const message = error instanceof Error && /credentials are not configured/.test(error.message)
      ? "NameSilo credentials are not configured for the current DOMAIN_PROVIDER_MODE. Set NAMESILO_SANDBOX_API_KEY for namesilo-sandbox, or NAMESILO_API_KEY for namesilo."
      : error instanceof Error && /not the configured domain provider/.test(error.message)
        ? "Price retrieval is disabled because NameSilo is not the configured domain provider. Set DOMAIN_PROVIDER_MODE=namesilo-sandbox for sandbox verification."
        : "NameSilo standard prices could not be retrieved. No catalogue data was changed."
    return json({ error: message }, 503)
  }
}
