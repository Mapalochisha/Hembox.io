import { NextResponse } from "next/server"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient as createAuthClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
function json(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }) }
const actionSchema = z.discriminatedUnion("action", [
  z.object({ projectId: z.string().uuid(), action: z.literal("approve_milestone"), milestoneId: z.string().uuid() }).strict(),
  z.object({ projectId: z.string().uuid(), action: z.literal("approve_deliverable"), deliverableId: z.string().uuid() }).strict(),
  z.object({ projectId: z.string().uuid(), action: z.literal("request_deliverable_changes"), deliverableId: z.string().uuid(), note: z.string().trim().min(5).max(2000) }).strict(),
  z.object({ projectId: z.string().uuid(), action: z.literal("create_change_request"), title: z.string().trim().min(3).max(180), description: z.string().trim().min(10).max(4000) }).strict(),
])

async function getOwnedProject(db: SupabaseClient, projectId: string, customerId: string) {
  const { data: clients, error: clientsError } = await db.from("clients").select("id,company_name").eq("user_id", customerId).limit(20)
  if (clientsError) throw clientsError
  const clientIds = (clients ?? []).map((client) => client.id)
  if (!clientIds.length) return null
  type ProjectRow = { id:string; client_id:string; name:string; description:string|null; category?:string|null; status:string; deadline:string|null; created_at:string; updated_at:string }
  const initial = await db.from("projects").select("id,client_id,name,description,category,status,deadline,created_at,updated_at").eq("id", projectId).in("client_id", clientIds).maybeSingle()
  let project = initial.data as unknown as ProjectRow | null
  let queryError = initial.error as {code?:string;message?:string}|null
  if (queryError && (queryError.code === "PGRST204" || queryError.code === "42703" || String(queryError.message || "").toLowerCase().includes("category"))) {
    const fallback = await db.from("projects").select("id,client_id,name,description,status,deadline,created_at,updated_at").eq("id", projectId).in("client_id", clientIds).maybeSingle()
    project = fallback.data as unknown as ProjectRow | null
    queryError = fallback.error
  }
  if (queryError) throw queryError
  return project ? { ...project, category: project.category || "custom" } : null
}

export async function GET(request: Request) {
  try {
    const auth = createAuthClient()
    const { data: { user }, error: authError } = await auth.auth.getUser()
    if (authError || !user) return json({ error: "Sign in to view project collaboration." }, 401)
    const projectId = new URL(request.url).searchParams.get("projectId")
    if (!projectId || !z.string().uuid().safeParse(projectId).success) return json({ error: "Provide a valid project." }, 400)
    const db = auth as unknown as SupabaseClient
    const project = await getOwnedProject(db, projectId, user.id)
    if (!project) return json({ error: "Project not found." }, 404)
    const [milestoneResult, deliverableResult, changeResult, activityResult, filesResult] = await Promise.all([
      db.from("project_milestones").select("id,title,description,status,due_at,sort_order,approved_at,created_at,updated_at").eq("project_id", project.id).order("sort_order").order("created_at"),
      db.from("project_deliverables").select("id,milestone_id,title,description,filename,mime_type,size_bytes,version,status,feedback_note,shared_at,approved_at,created_at,updated_at").eq("project_id", project.id).neq("status","draft").neq("status","superseded").order("created_at",{ascending:false}),
      db.from("project_change_requests").select("id,title,description,status,decision_note,reviewed_at,created_at,updated_at").eq("project_id", project.id).eq("customer_id",user.id).order("created_at",{ascending:false}),
      db.from("project_activity").select("id,actor_role,event_type,title,details,created_at").eq("project_id", project.id).order("created_at",{ascending:false}).limit(100),
      db.from("client_files").select("id,filename,mime_type,size_bytes,category,description,created_at").eq("customer_id",user.id).eq("project_id",project.id).eq("visibility","client").order("created_at",{ascending:false}).limit(200),
    ])
    const failure = milestoneResult.error || deliverableResult.error || changeResult.error || activityResult.error || filesResult.error
    if (failure) {
      console.error("[Portal] Project collaboration read failed:", failure)
      return json({ error: "Project collaboration data is not available yet." }, 503)
    }
    return json({ milestones: milestoneResult.data ?? [], deliverables: deliverableResult.data ?? [], changeRequests: changeResult.data ?? [], activity: activityResult.data ?? [], files: filesResult.data ?? [] })
  } catch (error) {
    console.error("[Portal] Project collaboration failed:", error)
    return json({ error: "Project collaboration data is temporarily unavailable." }, 503)
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = actionSchema.safeParse(body)
  if (!parsed.success) return json({ error: "Provide a valid project action." }, 400)
  try {
    const auth = createAuthClient()
    const { data: { user }, error: authError } = await auth.auth.getUser()
    if (authError || !user) return json({ error: "Sign in to update this project." }, 401)
    const db = auth as unknown as SupabaseClient
    const project = await getOwnedProject(db, parsed.data.projectId, user.id)
    if (!project) return json({ error: "Project not found." }, 404)

    let activityTitle = ""
    if (parsed.data.action === "approve_milestone") {
      const { data: milestone, error } = await db.from("project_milestones").select("id,status,title").eq("id",parsed.data.milestoneId).eq("project_id",project.id).maybeSingle()
      if (error) throw error
      if (!milestone) return json({ error: "Milestone not found." }, 404)
      if (milestone.status !== "ready_for_review") return json({ error: "Only milestones ready for review can be approved." }, 409)
      const { error: updateError } = await db.from("project_milestones").update({ status:"approved",approved_by:user.id,approved_at:new Date().toISOString(),updated_at:new Date().toISOString() }).eq("id",milestone.id)
      if (updateError) throw updateError
      activityTitle = "Milestone approved: " + milestone.title
    } else if (parsed.data.action === "approve_deliverable") {
      const { data: deliverable, error } = await db.from("project_deliverables").select("id,status,title").eq("id",parsed.data.deliverableId).eq("project_id",project.id).maybeSingle()
      if (error) throw error
      if (!deliverable) return json({ error: "Deliverable not found." }, 404)
      if (deliverable.status !== "shared") return json({ error: "Only shared deliverables can be approved." }, 409)
      const { error: updateError } = await db.from("project_deliverables").update({ status:"approved",approved_by:user.id,approved_at:new Date().toISOString(),feedback_note:null,updated_at:new Date().toISOString() }).eq("id",deliverable.id)
      if (updateError) throw updateError
      activityTitle = "Deliverable approved: " + deliverable.title
    } else if (parsed.data.action === "request_deliverable_changes") {
      const { data: deliverable, error } = await db.from("project_deliverables").select("id,status,title").eq("id",parsed.data.deliverableId).eq("project_id",project.id).maybeSingle()
      if (error) throw error
      if (!deliverable || !["shared","approved","changes_requested"].includes(deliverable.status)) return json({ error: "Deliverable is not available for feedback." }, 404)
      const { error: updateError } = await db.from("project_deliverables").update({ status:"changes_requested",feedback_note:parsed.data.note,approved_by:null,approved_at:null,updated_at:new Date().toISOString() }).eq("id",deliverable.id)
      if (updateError) throw updateError
      activityTitle = "Changes requested: " + deliverable.title
    } else {
      const { error } = await db.from("project_change_requests").insert({ project_id:project.id,customer_id:user.id,title:parsed.data.title,description:parsed.data.description })
      if (error) throw error
      activityTitle = "Change request submitted: " + parsed.data.title
    }

    try {
      await db.from("project_activity").insert({ project_id:project.id,actor_id:user.id,actor_role:"customer",event_type:parsed.data.action,title:activityTitle,details:{} })
    } catch (activityError) {
      console.error("[Portal] Action saved but activity log failed:", activityError)
    }
    return json({ success:true,message:"Your project update has been recorded." },201)
  } catch (error) {
    console.error("[Portal] Project action failed:", error)
    return json({ error: "Unable to save this project update right now." },503)
  }
}
