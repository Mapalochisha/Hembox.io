import { NextResponse } from "next/server"
import { Buffer } from "node:buffer"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient as createAuthClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
const BUCKET = "client-deliverables"
const MAX_BYTES = 20 * 1024 * 1024
const ALLOWED: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp",
  "image/svg+xml": "svg", "application/pdf": "pdf", "application/zip": "zip",
  "text/plain": "txt", "text/markdown": "md", "application/json": "json",
  "application/octet-stream": "bin",
}
function json(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }) }

async function currentUser() {
  const auth = createAuthClient()
  const { data: { user }, error } = await auth.auth.getUser()
  return error || !user ? null : user
}

async function ownedProject(db: SupabaseClient, projectId: string, customerId: string) {
  const { data: clients, error: clientsError } = await db.from("clients").select("id").eq("user_id", customerId).limit(20)
  if (clientsError) throw clientsError
  const ids = (clients ?? []).map((client) => client.id)
  if (!ids.length) return null
  const { data, error } = await db.from("projects").select("id").eq("id", projectId).in("client_id", ids).maybeSingle()
  if (error) throw error
  return data
}

export async function GET(request: Request) {
  try {
    const user = await currentUser()
    if (!user) return json({ error: "Sign in to view your files." }, 401)
    const db = auth as unknown as SupabaseClient
    const params = new URL(request.url).searchParams
    const fileId = params.get("fileId")
    const deliverableId = params.get("deliverableId")

    if (deliverableId) {
      const { data: deliverable, error } = await db.from("project_deliverables")
        .select("id,project_id,storage_bucket,storage_path,filename,status")
        .eq("id", deliverableId).maybeSingle()
      if (error) throw error
      if (!deliverable || !(await ownedProject(db, deliverable.project_id, user.id))) return json({ error: "File not found." }, 404)
      if (deliverable.status === "draft" || deliverable.status === "superseded") return json({ error: "This deliverable is not available for download." }, 409)
      const { data, error: signError } = await db.storage.from(deliverable.storage_bucket || BUCKET).createSignedUrl(deliverable.storage_path, 60)
      if (signError) throw signError
      return json({ url: data.signedUrl, filename: deliverable.filename, expiresIn: 60 })
    }

    if (fileId) {
      const { data: file, error } = await db.from("client_files").select("id,storage_bucket,storage_path,filename,visibility")
        .eq("id", fileId).eq("customer_id", user.id).eq("visibility", "client").maybeSingle()
      if (error) throw error
      if (!file) return json({ error: "File not found." }, 404)
      const { data, error: signError } = await db.storage.from(file.storage_bucket || BUCKET).createSignedUrl(file.storage_path, 60)
      if (signError) throw signError
      return json({ url: data.signedUrl, filename: file.filename, expiresIn: 60 })
    }

    const { data: files, error } = await db.from("client_files")
      .select("id,project_id,service_id,filename,mime_type,size_bytes,category,description,created_at")
      .eq("customer_id", user.id).eq("visibility", "client").order("created_at", { ascending: false }).limit(200)
    if (error) throw error
    const projectIds = Array.from(new Set((files ?? []).map((file) => file.project_id).filter(Boolean)))
    const projectNames = new Map<string, string>()
    if (projectIds.length) {
      const { data: clients, error: clientsError } = await db.from("clients").select("id").eq("user_id", user.id).limit(20)
      if (clientsError) throw clientsError
      const clientIds = (clients ?? []).map((client) => client.id)
      if (clientIds.length) {
        const { data: projects, error: projectsError } = await db.from("projects").select("id,name").in("id", projectIds).in("client_id", clientIds)
        if (projectsError) throw projectsError
        for (const project of projects ?? []) projectNames.set(project.id, project.name)
      }
    }
    return json({ files: (files ?? []).map((file) => ({ ...file, project_name: file.project_id ? projectNames.get(file.project_id) ?? null : null })) })
  } catch (error) {
    console.error("[Portal] File library read failed:", error)
    return json({ error: "Your file library is not available yet. Please try again later." }, 503)
  }
}

export async function POST(request: Request) {
  try {
    const user = await currentUser()
    if (!user) return json({ error: "Sign in to upload a file." }, 401)
    const form = await request.formData()
    const candidate = form.get("file")
    const projectId = String(form.get("projectId") ?? "").trim()
    const description = String(form.get("description") ?? "").trim().slice(0, 1000)
    if (!(candidate instanceof File)) return json({ error: "Choose a file to upload." }, 400)
    if (candidate.size < 1 || candidate.size > MAX_BYTES) return json({ error: "Files must be between 1 byte and 20 MB." }, 400)
    if (!ALLOWED[candidate.type]) return json({ error: "This file type is not supported. Upload an image, PDF, ZIP, text, Markdown or JSON file." }, 400)

    const db = auth as unknown as SupabaseClient
    if (projectId && !(await ownedProject(db, projectId, user.id))) return json({ error: "Project not found." }, 404)
    const extension = ALLOWED[candidate.type]
    const objectName = crypto.randomUUID() + "." + extension
    const storagePath = user.id + "/uploads/" + objectName
    const { error: uploadError } = await db.storage.from(BUCKET).upload(storagePath, Buffer.from(await candidate.arrayBuffer()), { contentType: candidate.type, upsert: false })
    if (uploadError) throw uploadError

    const { data: file, error: insertError } = await db.from("client_files").insert({
      customer_id: user.id, project_id: projectId || null, storage_bucket: BUCKET,
      storage_path: storagePath, filename: candidate.name.slice(0, 255),
      mime_type: candidate.type, size_bytes: candidate.size, category: "reference",
      description: description || null, visibility: "client", uploader_role: "customer", uploaded_by: user.id,
    }).select("id,project_id,filename,mime_type,size_bytes,category,description,created_at").single()
    if (insertError) {
      await db.storage.from(BUCKET).remove([storagePath])
      throw insertError
    }
    return json({ file }, 201)
  } catch (error) {
    console.error("[Portal] File upload failed:", error)
    return json({ error: "The file could not be uploaded. Check the file type and size, then try again." }, 503)
  }
}
