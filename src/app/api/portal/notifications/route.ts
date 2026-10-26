import { NextResponse } from "next/server"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient as createAuthClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
const schema = z.object({ notificationId: z.string().uuid().optional(), markAllRead: z.boolean().optional() }).strict()
function json(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }) }

export async function GET() {
  try {
    const auth = createAuthClient()
    const { data: { user }, error: authError } = await auth.auth.getUser()
    if (authError || !user) return json({ error: "Sign in to view notifications." }, 401)
    const db = auth as unknown as SupabaseClient
    const { data, error } = await db.from("client_notifications")
      .select("id,category,title,body,href,read_at,created_at")
      .eq("customer_id", user.id).order("created_at", { ascending: false }).limit(100)
    if (error) throw error
    const notifications = data ?? []
    return json({ notifications, unreadCount: notifications.filter((item) => !item.read_at).length })
  } catch (error) {
    console.error("[Portal] Notifications read failed:", error)
    return json({ error: "Notifications are not available yet." }, 503)
  }
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success || (!parsed.data.notificationId && !parsed.data.markAllRead)) return json({ error: "Provide a notification to mark as read." }, 400)
  try {
    const auth = createAuthClient()
    const { data: { user }, error: authError } = await auth.auth.getUser()
    if (authError || !user) return json({ error: "Sign in to update notifications." }, 401)
    const db = createServiceClient() as unknown as SupabaseClient
    let query = db.from("client_notifications").update({ read_at: new Date().toISOString() }).eq("customer_id", user.id).is("read_at", null)
    if (parsed.data.notificationId) query = query.eq("id", parsed.data.notificationId)
    const { error } = await query
    if (error) throw error
    return json({ success: true })
  } catch (error) {
    console.error("[Portal] Notification update failed:", error)
    return json({ error: "Unable to update notifications right now." }, 503)
  }
}
