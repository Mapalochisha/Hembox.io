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

  const domain = new URL(request.url).searchParams.get("domain")?.trim()
  if (!domain) {
    return NextResponse.json({ error: "Provide a .com or .net test domain." }, { status: 400, headers })
  }

  try {
    const operations = createNameSiloSandboxOperations()
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
