import { NextResponse } from "next/server"
import { z } from "zod"
import { getDomainProvider } from "@/lib/domains/provider"
import { parseDomainSearchRequest } from "@/lib/domains/validation"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 })
  }

  const parsed = parseDomainSearchRequest(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Provide between 1 and 10 valid fully-qualified domain names." },
      { status: 400 },
    )
  }

  try {
    const provider = getDomainProvider()
    const results = await provider.checkAvailability(parsed.data.domains)

    return NextResponse.json({
      provider: provider.id,
      environment: provider.environment,
      live: provider.environment === "live" && provider.capabilities.availabilitySearch,
      results,
    }, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch {
    return NextResponse.json(
      { error: "Live domain search is not configured yet. Please use the domain enquiry form." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }
}
