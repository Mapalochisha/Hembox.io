import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

export const dynamic = "force-dynamic"
const MAX_SIZE = 10 * 1024 * 1024
function json(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }) }

export async function POST(request: Request) {
  try {
    const authClient = createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) return json({ error: "Sign in to upload payment evidence." }, 401)
    const form = await request.formData()
    const invoiceId = String(form.get("invoiceId") ?? "")
    const file = form.get("receipt")
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(invoiceId) || !(file instanceof File)) {
      return json({ error: "Choose a receipt file and invoice." }, 400)
    }
    if (file.size < 1 || file.size > MAX_SIZE) return json({ error: "Receipt must be 10 MB or smaller." }, 400)
    const allowed = new Map([["image/png","png"],["image/jpeg","jpg"],["application/pdf","pdf"]])
    if (!allowed.has(file.type)) return json({ error: "Only PNG, JPG/JPEG, and PDF receipts are accepted." }, 400)
    const bytes = new Uint8Array(await file.arrayBuffer())
    const isPng = bytes.length >= 8 && bytes[0]===0x89 && bytes[1]===0x50 && bytes[2]===0x4e && bytes[3]===0x47 && bytes[4]===0x0d && bytes[5]===0x0a && bytes[6]===0x1a && bytes[7]===0x0a
    const isJpeg = bytes.length >= 3 && bytes[0]===0xff && bytes[1]===0xd8 && bytes[2]===0xff
    const isPdf = bytes.length >= 5 && String.fromCharCode(...bytes.slice(0,5)) === "%PDF-"
    if (!(file.type==="image/png"&&isPng) && !(file.type==="image/jpeg"&&isJpeg) && !(file.type==="application/pdf"&&isPdf)) {
      return json({ error: "The file content does not match its declared receipt type." }, 400)
    }
    const db = createServiceClient() as unknown as SupabaseClient
    const { data: invoice, error } = await db.from("billing_invoices").select("id,customer_id,status").eq("id",invoiceId).maybeSingle()
    if (error) throw error
    if (!invoice || invoice.customer_id !== user.id) return json({ error: "Invoice not found." }, 404)
    if (!["unpaid","partially_paid","overdue"].includes(invoice.status)) return json({ error: "This invoice is not accepting payment evidence." }, 409)
    const extension = allowed.get(file.type)!
    const objectKey = `${user.id}/${invoice.id}/${crypto.randomUUID()}.${extension}`
    const { error: uploadError } = await db.storage.from("billing-receipts").upload(objectKey,new Blob([bytes],{type:file.type}),{contentType:file.type,upsert:false,cacheControl:"60"})
    if (uploadError) throw uploadError
    return json({ objectKey, mimeType:file.type, sizeBytes:bytes.length },201)
  } catch (error) {
    console.error("[Billing] Receipt upload failed:",error)
    return json({ error:"Unable to securely upload this receipt right now." },500)
  }
}
