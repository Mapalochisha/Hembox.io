import { NextResponse } from "next/server"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient as createAuthClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

export const dynamic = "force-dynamic"
const sendSchema = z.object({ conversationId: z.string().uuid(), body: z.string().trim().min(1).max(5000) }).strict()
function json(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }) }

export async function GET() {
  try {
    const auth = createAuthClient()
    const { data: { user }, error: authError } = await auth.auth.getUser()
    if (authError || !user) return json({ error: "Sign in to view your messages." }, 401)
    const db = createServiceClient() as unknown as SupabaseClient
    const { data: threads, error } = await db.from("inquiries")
      .select("id,type,status,source,message,created_at,updated_at")
      .eq("customer_id", user.id).order("updated_at", { ascending: false }).limit(100)
    if (error) throw error
    const ids = (threads ?? []).map((thread) => thread.id)
    const { data: messages, error: messagesError } = ids.length
      ? await db.from("inquiry_messages").select("id,inquiry_id,sender_role,body,created_at").in("inquiry_id", ids).order("created_at", { ascending: true }).limit(1000)
      : { data: [], error: null }
    if (messagesError) throw messagesError
    const byThread: Record<string, typeof messages> = {}
    for (const message of messages ?? []) byThread[message.inquiry_id] = [...(byThread[message.inquiry_id] ?? []), message]
    return json({ threads: (threads ?? []).map((thread) => ({ ...thread, messages: byThread[thread.id]?.length ? byThread[thread.id] : thread.message ? [{ id: "initial-" + thread.id, inquiry_id: thread.id, sender_role: "customer", body: thread.message, created_at: thread.created_at }] : [] })) })
  } catch (error) {
    console.error("[Portal] Message inbox failed:", error)
    return json({ error: "Messages are temporarily unavailable." }, 503)
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = sendSchema.safeParse(body)
  if (!parsed.success) return json({ error: "Enter a valid conversation and a message of up to 5,000 characters." }, 400)
  try {
    const auth = createAuthClient()
    const { data: { user }, error: authError } = await auth.auth.getUser()
    if (authError || !user) return json({ error: "Sign in to send a message." }, 401)
    const db = createServiceClient() as unknown as SupabaseClient
    const { data: thread, error: threadError } = await db.from("inquiries").select("id,status")
      .eq("id", parsed.data.conversationId).eq("customer_id", user.id).maybeSingle()
    if (threadError) throw threadError
    if (!thread) return json({ error: "Conversation not found." }, 404)
    if (thread.status === "archived") return json({ error: "This conversation is archived. Start a new request to contact HEMBOX." }, 409)
    const { data: message, error } = await db.from("inquiry_messages").insert({
      inquiry_id: thread.id, sender_role: "customer", sender_id: user.id, body: parsed.data.body.trim(),
    }).select("id,inquiry_id,sender_role,body,created_at").single()
    if (error) throw error
    return json({ message }, 201)
  } catch (error) {
    console.error("[Portal] Sending message failed:", error)
    return json({ error: "Unable to send your message right now." }, 503)
  }
}
