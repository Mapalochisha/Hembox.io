import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { refreshBozFxAndReprice } from "@/lib/domains/refresh-fx"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

// Sentry Crons monitor — upserted from this config on the first check-in.
// Schedule matches the Vercel Cron entry in vercel.json (daily 14:00 UTC).
const monitorConfig = {
  schedule: { type: "crontab" as const, value: "0 14 * * *" },
  checkinMargin: 5, // minutes before a missed check-in is reported
  maxRuntime: 1, // minutes, matching the route's maxDuration
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const authorization = request.headers.get("authorization")
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const checkInId = Sentry.captureCheckIn(
    { monitorSlug: "domain-fx-refresh", status: "in_progress" },
    monitorConfig,
  )

  try {
    const result = await refreshBozFxAndReprice()
    Sentry.captureCheckIn(
      { checkInId, monitorSlug: "domain-fx-refresh", status: "ok" },
      monitorConfig,
    )
    return NextResponse.json({ ok: true, ...result }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    })
  } catch (error) {
    console.error("Daily BoZ FX refresh failed:", error)
    Sentry.captureException(error)
    Sentry.captureCheckIn(
      { checkInId, monitorSlug: "domain-fx-refresh", status: "error" },
      monitorConfig,
    )
    return NextResponse.json({ error: error instanceof Error ? error.message : "FX refresh failed." }, { status: 503 })
  }
}