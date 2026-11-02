import { NextResponse } from "next/server"
import { z } from "zod"
import { createNameSiloSandboxOperations } from "@/lib/domains/providers/namesilo-sandbox-operations"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const schema = z.object({ domainName: z.string().trim().toLowerCase().min(3).max(253) }).strict()
const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" }

export async function POST(request: Request) {
  if (process.env.DOMAIN_PROVIDER_MODE?.trim().toLowerCase() !== "namesilo-sandbox") {
    return NextResponse.json({ error: "The domain sandbox is not enabled." }, { status: 404, headers })
  }
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid domain name." }, { status: 400, headers })
  try {
    const result = await createNameSiloSandboxOperations().checkAvailability([parsed.data.domainName])
    return NextResponse.json({ provider: "namesilo", environment: "test", live: false, result: result[0] }, { headers })
  } catch (error) {
    const message = error instanceof Error && /valid|restricted/.test(error.message)
      ? error.message
      : "NameSilo OTE availability is temporarily unavailable."
    return NextResponse.json({ error: message }, { status: 503, headers })
  }
}
