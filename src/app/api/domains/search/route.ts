import { NextResponse } from "next/server"
import { z } from "zod"
import { getDomainProvider } from "@/lib/domains/provider"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const requestSchema = z.object({
  domains: z.array(z.string().trim().toLowerCase().min(3).max(253)).min(1).max(10),
}).strict()

function isDomain(value: string) {
  const labels = value.split(".")
  return labels.length >= 2 && labels.every((label) =>
    label.length >= 1 &&
    label.length <= 63 &&
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
  )
}

export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success || !parsed.data.domains.every(isDomain)) {
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
      live: provider.capabilities.availabilitySearch,
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
