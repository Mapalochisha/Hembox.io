import { NextResponse } from "next/server"
import { createNameSiloSandboxOperations } from "@/lib/domains/providers/namesilo-sandbox-operations"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const headers = {
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex",
}

/**
 * Read-only NameSilo OTE diagnostics. This endpoint is intentionally available
 * only on a Vercel Preview deployment explicitly configured for the sandbox.
 * The Vercel project must keep Preview deployment protection enabled.
 */
function isProtectedSandboxPreview(): boolean {
  return process.env.VERCEL_ENV === "preview" &&
    process.env.DOMAIN_PROVIDER_MODE?.trim().toLowerCase() === "namesilo-sandbox"
}

export async function GET(request: Request) {
  if (!isProtectedSandboxPreview()) {
    return NextResponse.json({ error: "Not found." }, { status: 404, headers })
  }

  const url = new URL(request.url)
  const scope = url.searchParams.get("scope")?.trim().toLowerCase()
  const domain = url.searchParams.get("domain")?.trim()

  if (scope && scope !== "account") {
    return NextResponse.json({ error: "Unknown diagnostic scope." }, { status: 400, headers })
  }
  if (scope && domain) {
    return NextResponse.json({ error: "Provide either domain or scope=account, not both." }, { status: 400, headers })
  }
  if (scope !== "account" && !domain) {
    return NextResponse.json({
      error: "Provide a .com or .net test domain, or scope=account for read-only account probes.",
    }, { status: 400, headers })
  }

  try {
    const operations = createNameSiloSandboxOperations()

    if (scope === "account") {
      // Read-only probes that do not reference a domain. getDomainInfo is
      // documented as account-scoped, so these establish whether the key,
      // account and transport work before any domain-level conclusion.
      const balance = await operations.getAccountBalance()
      const domains = await operations.listDomains()
      return NextResponse.json({
        provider: "namesilo",
        environment: "test",
        live: false,
        scope: "account",
        result: { balance, domains },
      }, { headers })
    }

    if (!domain) {
      return NextResponse.json({ error: "Provide a .com or .net test domain." }, { status: 400, headers })
    }

    const result = await operations.getDomainInfo(domain)
    return NextResponse.json({
      provider: "namesilo",
      environment: "test",
      live: false,
      result,
    }, { headers })
  } catch (error) {
    const message = error instanceof Error && /valid|restricted/.test(error.message)
      ? error.message
      : "NameSilo OTE diagnostics are temporarily unavailable."
    return NextResponse.json({ error: message }, { status: 400, headers })
  }
}
