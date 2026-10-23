import { NextResponse } from "next/server"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

export const dynamic = "force-dynamic"

const itemSchema = z.object({
  description: z.string().trim().min(1).max(240),
  quantity: z.number().int().min(1).max(10000).default(1),
  unitAmountMinor: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  sourceType: z.string().trim().max(80).optional(),
  sourceId: z.string().uuid().optional(),
  itemSnapshot: z.record(z.unknown()).optional(),
}).strict()
const createSchema = z.object({
  customerId: z.string().uuid(),
  invoiceNumber: z.string().trim().min(4).max(40).regex(/^[A-Za-z0-9][A-Za-z0-9._/-]+$/),
  currency: z.enum(["ZMW", "USD"]),
  usdClientRequested: z.boolean().optional(),
  dueAt: z.string().datetime().optional().nullable(),
  sourceType: z.enum(["website_plan", "domain_registration", "domain_renewal", "addon", "custom_work", "adjustment", "other"]).optional().nullable(),
  sourceId: z.string().uuid().optional().nullable(),
  customerNote: z.string().trim().max(1000).optional(),
  taxMinor: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  commercialSnapshot: z.record(z.unknown()).optional(),
  creationKey: z.string().trim().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/),
  items: z.array(itemSchema).min(1).max(50),
}).strict()

function json(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }) }
async function requireAdmin() {
  const authClient = createClient()
  const { data: { user }, error } = await authClient.auth.getUser()
  if (error || !user) return { status: 401 as const }
  const { data: role, error: roleError } = await authClient.rpc("get_user_role", { user_id: user.id })
  if (roleError) return { status: 503 as const }
  if (role !== "admin") return { status: 403 as const }
  return { status: 200 as const, userId: user.id }
}

export async function GET() {
  try {
    const auth = await requireAdmin()
    if (auth.status !== 200) return json({ error: auth.status === 401 ? "Authentication required." : auth.status === 403 ? "Administrator access required." : "Unable to verify administrator access." }, auth.status)
    const db = createServiceClient() as unknown as SupabaseClient
    const [{ data: invoices, error }, { data: profiles, error: profilesError }] = await Promise.all([
      db.from("billing_invoices").select("id,invoice_number,customer_id,status,currency,subtotal_minor,tax_minor,total_minor,issued_at,due_at,source_type,source_id,created_at").order("created_at", { ascending: false }).limit(200),
      db.from("profiles").select("id,email,full_name").order("full_name", { ascending: true }).limit(1000),
    ])
    if (error) throw error
    if (profilesError) throw profilesError
    const ids = (invoices ?? []).map((invoice) => invoice.id)
    const { data: items, error: itemsError } = ids.length
      ? await db.from("billing_invoice_items").select("id,invoice_id,description,quantity,unit_amount_minor,line_total_minor").in("invoice_id", ids)
      : { data: [], error: null }
    if (itemsError) throw itemsError
    const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]))
    const itemMap = new Map<string, unknown[]>()
    for (const item of items ?? []) itemMap.set(item.invoice_id, [...(itemMap.get(item.invoice_id) ?? []), item])
    return json({ invoices: (invoices ?? []).map((invoice) => ({ ...invoice, customer: profileMap.get(invoice.customer_id) ?? null, items: itemMap.get(invoice.id) ?? [] })), customers: profiles ?? [] })
  } catch (error) {
    console.error("[Billing admin] Failed to load invoices:", error)
    return json({ error: "Unable to load billing invoices right now." }, 500)
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return json({ error: "Provide a valid invoice, customer, currency, and at least one line item." }, 400)
  if (parsed.data.currency === "USD" && parsed.data.usdClientRequested !== true) return json({ error: "USD invoices require confirmation that the client explicitly requested USD." }, 400)
  try {
    const auth = await requireAdmin()
    if (auth.status !== 200) return json({ error: auth.status === 401 ? "Authentication required." : auth.status === 403 ? "Administrator access required." : "Unable to verify administrator access." }, auth.status)
    const db = createServiceClient() as unknown as SupabaseClient
    const { data, error } = await db.rpc("create_billing_invoice", {
      p_admin_id: auth.userId,
      p_customer_id: parsed.data.customerId,
      p_invoice_number: parsed.data.invoiceNumber,
      p_currency: parsed.data.currency,
      p_due_at: parsed.data.dueAt || null,
      p_source_type: parsed.data.sourceType || null,
      p_source_id: parsed.data.sourceId || null,
      p_customer_note: parsed.data.customerNote || null,
      p_commercial_snapshot: { ...(parsed.data.commercialSnapshot ?? {}), currency_policy: { default_currency: "ZMW", invoice_currency: parsed.data.currency, client_explicitly_requested_usd: parsed.data.currency === "USD" && parsed.data.usdClientRequested === true } },
      p_items: parsed.data.items.map((item) => ({ description: item.description, quantity: item.quantity, unit_amount_minor: item.unitAmountMinor, source_type: item.sourceType ?? null, source_id: item.sourceId ?? null, item_snapshot: item.itemSnapshot ?? {} })),
      p_creation_key: parsed.data.creationKey,
      p_tax_minor: parsed.data.taxMinor,
    })
    if (error) {
      if (error.code === "42501") return json({ error: "Administrator access is required to issue invoices." }, 403)
      if (error.code === "23505") return json({ error: "Invoice number or source reference already exists. Check the invoice list before retrying." }, 409)
      if (["22023", "22003", "23514"].includes(error.code ?? "")) return json({ error: error.message }, 400)
      throw error
    }
    return json({ result: Array.isArray(data) ? data[0] : data }, 201)
  } catch (error) {
    console.error("[Billing admin] Failed to issue invoice:", error)
    return json({ error: "Unable to issue this invoice right now. Please review the details and try again." }, 500)
  }
}
