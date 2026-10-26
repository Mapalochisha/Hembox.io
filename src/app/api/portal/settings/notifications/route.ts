import { NextResponse } from "next/server"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient as createAuthClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
const schema = z.object({
  project_updates: z.boolean(),
  service_updates: z.boolean(),
  billing_updates: z.boolean(),
  domain_updates: z.boolean(),
  message_updates: z.boolean(),
}).strict()
const defaults = { project_updates:true,service_updates:true,billing_updates:true,domain_updates:true,message_updates:true }
function json(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }) }

export async function GET() {
  try {
    const auth = createAuthClient()
    const { data: { user }, error: authError } = await auth.auth.getUser()
    if (authError || !user) return json({ error: "Sign in to manage preferences." }, 401)
    const db = auth as unknown as SupabaseClient
    const { data, error } = await db.from("client_notification_preferences").select("project_updates,service_updates,billing_updates,domain_updates,message_updates").eq("customer_id",user.id).maybeSingle()
    if (error) throw error
    return json({ preferences: data ?? defaults })
  } catch (error) {
    console.error("[Portal] Notification preferences read failed:", error)
    return json({ error: "Notification preferences are not available yet." }, 503)
  }
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return json({ error: "Provide valid notification preferences." }, 400)
  try {
    const auth = createAuthClient()
    const { data: { user }, error: authError } = await auth.auth.getUser()
    if (authError || !user) return json({ error: "Sign in to save preferences." }, 401)
    const db = auth as unknown as SupabaseClient
    const { data, error } = await db.from("client_notification_preferences")
      .upsert({ customer_id:user.id,...parsed.data,updated_at:new Date().toISOString() },{onConflict:"customer_id"})
      .select("project_updates,service_updates,billing_updates,domain_updates,message_updates").single()
    if (error) throw error
    return json({ preferences:data,message:"Your notification preferences have been saved." })
  } catch (error) {
    console.error("[Portal] Notification preferences save failed:", error)
    return json({ error: "Unable to save preferences right now." }, 503)
  }
}
