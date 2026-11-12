import { NextResponse } from "next/server"
import { getDomainProvider } from "@/lib/domains/provider"
import { parseDomainSearchRequest } from "@/lib/domains/validation"
import { checkRateLimit, SEARCH_RATE_LIMIT } from "@/lib/domains/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "unknown"
  const rateLimit = checkRateLimit(ip, SEARCH_RATE_LIMIT.windowMs, SEARCH_RATE_LIMIT.maxRequests)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before trying again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000)) } },
    )
  }

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
