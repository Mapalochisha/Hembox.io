import { NextResponse } from "next/server"
import { refreshBozFxAndReprice } from "@/lib/domains/refresh-fx"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const authorization = request.headers.get("authorization")
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  try {
    const result = await refreshBozFxAndReprice()
    return NextResponse.json({ ok: true, ...result }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    })
  } catch (error) {
    console.error("Daily BoZ FX refresh failed:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "FX refresh failed." }, { status: 503 })
  }
}
