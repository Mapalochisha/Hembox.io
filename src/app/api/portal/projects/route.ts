import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient as createAuthClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

export const dynamic = "force-dynamic"
function json(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }) }

export async function GET(request: Request) {
  try {
    const auth = createAuthClient()
    const { data: { user }, error: authError } = await auth.auth.getUser()
    if (authError || !user) return json({ error: "Sign in to view your projects." }, 401)

    const db = createServiceClient() as unknown as SupabaseClient
    const { data: clients, error: clientError } = await db.from("clients").select("id,company_name").eq("user_id", user.id).limit(20)
    if (clientError) throw clientError
    const clientIds = (clients ?? []).map((client) => client.id)
    if (!clientIds.length) return json({ projects: [] })

    let query = db.from("projects").select("id,client_id,name,description,category,status,deadline,created_at,updated_at").in("client_id", clientIds).order("updated_at", { ascending: false }).limit(200)
    const projectId = new URL(request.url).searchParams.get("projectId")
    if (projectId) query = query.eq("id", projectId)
    let result = await query
    if (result.error && (result.error.code === "PGRST204" || result.error.code === "42703" || String(result.error.message || "").toLowerCase().includes("category"))) {
      let fallback = db.from("projects").select("id,client_id,name,description,status,deadline,created_at,updated_at").in("client_id", clientIds).order("updated_at", { ascending: false }).limit(200)
      if (projectId) fallback = fallback.eq("id", projectId)
      result = await fallback
    }
    if (result.error) throw result.error
    const projects = (result.data ?? []).map((project) => ({ ...project, category: project.category || "custom" }))
    if (projectId && !projects.length) return json({ error: "Project not found." }, 404)
    return json({ projects, clients: clients ?? [] })
  } catch (error) {
    console.error("[Portal] Project lookup failed:", error)
    return json({ error: "Project information is temporarily unavailable." }, 503)
  }
}
