import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient as createAuthClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

export const dynamic = "force-dynamic"

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })
}

export async function GET() {
  try {
    const auth = createAuthClient()
    const { data: { user }, error: authError } = await auth.auth.getUser()
    if (authError || !user) return json({ error: "Sign in to view your workspace." }, 401)

    // The service client is used only after resolving the user from the verified
    // session. Every customer-data query is explicitly scoped to that user or
    // to client records owned by that user; never accept an owner ID from input.
    const db = createServiceClient() as unknown as SupabaseClient
    const [clientResult, invoiceResult, domainResult, conversationResult] = await Promise.all([
      db.from("clients").select("id,company_name,status").eq("user_id", user.id).limit(20),
      db.from("billing_invoices").select("id,invoice_number,status,currency,total_minor,due_at,created_at").eq("customer_id", user.id).in("status", ["unpaid", "partially_paid", "overdue"]).order("created_at", { ascending: false }).limit(100),
      db.from("domain_orders").select("id,domain_name,status,expires_at,created_at").eq("customer_id", user.id).order("created_at", { ascending: false }).limit(100),
      db.from("inquiries").select("id,type,status,source,message,created_at").eq("customer_id", user.id).order("created_at", { ascending: false }).limit(100),
    ])

    const failure = clientResult.error || invoiceResult.error || domainResult.error || conversationResult.error
    if (failure) {
      console.error("[Portal] Summary query failed:", failure)
      return json({ error: "Your workspace summary is temporarily unavailable." }, 503)
    }

    const clients = clientResult.data ?? []
    const clientIds = clients.map((client) => client.id)
    let projects: Array<{ id: string; name: string; description: string | null; status: string; deadline: string | null; updated_at: string | null }> = []
    if (clientIds.length) {
      const { data, error } = await db.from("projects").select("id,name,description,status,deadline,updated_at,client_id").in("client_id", clientIds).order("updated_at", { ascending: false }).limit(100)
      if (error) {
        console.error("[Portal] Project summary query failed:", error)
        return json({ error: "Project information is temporarily unavailable." }, 503)
      }
      projects = data ?? []
    }

    const invoices = invoiceResult.data ?? []
    const dueByCurrency: Record<string, number> = {}
    for (const invoice of invoices) {
      const currency = invoice.currency || "ZMW"
      dueByCurrency[currency] = (dueByCurrency[currency] ?? 0) + Number(invoice.total_minor || 0)
    }

    const domains = domainResult.data ?? []
    const conversations = (conversationResult.data ?? []).filter((item) => item.source === "billing" || item.type === "contact")
    const activeProjects = projects.filter((project) => ["in_progress", "review"].includes(project.status))
    const recentProjects = projects.slice(0, 4).map((project) => ({
      id: project.id, name: project.name, description: project.description,
      status: project.status, deadline: project.deadline, updated_at: project.updated_at,
    }))
    const recentInvoices = invoices.slice(0, 3).map((invoice) => ({
      id: invoice.id, invoice_number: invoice.invoice_number, status: invoice.status,
      currency: invoice.currency, total_minor: invoice.total_minor, due_at: invoice.due_at,
    }))
    const recentDomains = domains.slice(0, 3).map((domain) => ({
      id: domain.id, domain_name: domain.domain_name, status: domain.status, expires_at: domain.expires_at,
    }))

    return json({
      client: clients[0] ?? null,
      projects: { active: activeProjects.length, total: projects.length, recent: recentProjects },
      services: { tracked: false, active: null },
      billing: { outstanding_by_currency: dueByCurrency, invoices: recentInvoices, outstanding_count: invoices.length },
      domains: { count: domains.length, recent: recentDomains },
      conversations: { count: conversations.length },
      activity: [
        ...projects.slice(0, 4).map((item) => ({ id: "project-" + item.id, kind: "project", title: item.name, detail: "Project status: " + item.status.replaceAll("_", " "), at: item.updated_at })),
        ...invoices.slice(0, 3).map((item) => ({ id: "invoice-" + item.id, kind: "billing", title: "Invoice " + item.invoice_number, detail: "Status: " + item.status.replaceAll("_", " "), at: item.created_at })),
        ...domains.slice(0, 3).map((item) => ({ id: "domain-" + item.id, kind: "domain", title: item.domain_name, detail: "Domain order: " + item.status.replaceAll("_", " "), at: item.created_at })),
      ].filter((item) => item.at).sort((a, b) => new Date(b.at as string).getTime() - new Date(a.at as string).getTime()).slice(0, 6),
    })
  } catch (error) {
    console.error("[Portal] Unable to build overview:", error)
    return json({ error: "Your workspace summary is temporarily unavailable." }, 503)
  }
}
