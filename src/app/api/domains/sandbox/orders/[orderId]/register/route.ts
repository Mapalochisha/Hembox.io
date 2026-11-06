import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST() {
  return NextResponse.json({
    error: "Customer-side registration is disabled. Submit a sandbox payment reference and wait for administrator approval; only the administrator flow may call NameSilo OTE registerDomain.",
  }, { status: 410, headers: { "Cache-Control": "no-store" } })
}
