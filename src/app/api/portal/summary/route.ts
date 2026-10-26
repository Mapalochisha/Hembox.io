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
    const [clientResult, invoiceResult, domainResult, conversationResult, serviceResult, notificationResult] = await Promise.all([
      db.from("clients").select("id,company_name,status").eq("user_id", user.id).limit(20),
      db.from("billing_invoices").select("id,invoice_number,status,currency,total_minor,due_at,created_at").eq("customer_id", user.id).in("status", ["unpaid", "partially_paid", "overdue"]).order("created_at", { ascending: false }).limit(100),
      db.from("domain_orders").select("id,domain_name,status,expires_at,created_at").eq("customer_id", user.id).order("created_at", { ascending: false }).limit(100),
      db.from("inquiries").select("id,type,status,source,message,created_at").eq("customer_id", user.id).order("created_at", { ascending: false }).limit(100),
      db.from("client_services").select("id,status,renews_at,name").eq("customer_id", user.id).limit(200),
      db.from("client_notifications").select("id,read_at").eq("customer_id", user.id).limit(200),
    ])

    const serviceTableMissing = Boolean(serviceResult.error && (
      serviceResult.error.code === "PGRST205" ||
      serviceResult.error.code === "42P01" ||
      String(serviceResult.error.message || "").toLowerCase().includes("client_services")
    ))
    const notificationTableMissing = Boolean(notificationResult.error && (
      notificationResult.error.code === "PGRST205" ||
      notificationResult.error.code === "42P01" ||
      String(notificationResult.error.message || "").toLowerCase().includes("client_notifications")
    ))
    const failure = clientResult.error || invoiceResult.error || domainResult.error || conversationResult.error || (serviceTableMissing ? null : serviceResult.error) || (notificationTableMissing ? null : notificationResult.error)
    if (failure) {
      console.error("[Portal] Summary query failed:", failure)
      return json({ error: "Your workspace summary is temporarily unavailable." }, 503)
    }

    const clients = clientResult.data ?? []
    const clientIds = clients.map((client) => client.id)
    let projects: Array<{ id: string; name: string; description: string | null; category: string; status: string; deadline: string | null; updated_at: string | null }> = []
    if (clientIds.length) {
      let result = await db.from("projects").select("id,name,description,category,status,deadline,updated_at,client_id").in("client_id", clientIds).order("updated_at", { ascending: false }).limit(100)
      if (result.error && (result.error.code === "PGRST204" || result.error.code === "42703" || String(result.error.message || "").toLowerCase().includes("category"))) {
        result = await db.from("projects").select("id,name,description,status,deadline,updated_at,client_id").in("client_id", clientIds).order("updated_at", { ascending: false }).limit(100)
      }
      if (result.error) {
        console.error("[Portal] Project summary query failed:", result.error)
        return json({ error: "Project information is temporarily unavailable." }, 503)
      }
      projects = (result.data ?? []).map((project) => ({ ...project, category: project.category || "custom" }))
    }

    const invoices = invoiceResult.data ?? []
    const invoiceIds = invoices.map((invoice) => invoice.id)
    const { data: allocations, error: allocationsError } = invoiceIds.length
      ? await db.from("billing_payment_allocations").select("invoice_id,amount_minor,allocation_type").in("invoice_id", invoiceIds)
      : { data: [], error: null }
    if (allocationsError) {
      console.error("[Portal] Invoice allocation query failed:", allocationsError)
      return json({ error: "Billing information is temporarily unavailable." }, 503)
    }
    const allocatedByInvoice: Record<string, number> = {}
    for (const allocation of allocations ?? []) {
      const amount = Number(allocation.amount_minor || 0) * (allocation.allocation_type === "allocate" ? 1 : -1)
      allocatedByInvoice[allocation.invoice_id] = (allocatedByInvoice[allocation.invoice_id] ?? 0) + amount
    }
    const dueByCurrency: Record<string, number> = {}
    const balanceByInvoice: Record<string, number> = {}
    for (const invoice of invoices) {
      const currency = invoice.currency || "ZMW"
      const balance = Math.max(0, Number(invoice.total_minor || 0) - (allocatedByInvoice[invoice.id] ?? 0))
      balanceByInvoice[invoice.id] = balance
      if (balance > 0) dueByCurrency[currency] = (dueByCurrency[currency] ?? 0) + balance
    }
    const outstandingInvoices = invoices.filter((invoice) => (balanceByInvoice[invoice.id] ?? 0) > 0)

    const domains = domainResult.data ?? []
    const recentDomains = domains.slice(0, 3).map((domain) => ({
      id: domain.id, domain_name: domain.domain_name, status: domain.status, expires_at: domain.expires_at,
    }))
    const conversations = (conversationResult.data ?? []).filter((item) => item.source === "billing" || item.source === "client-portal" || item.type === "contact")
    const projectIds = projects.map((project) => project.id)
    const projectActivityResult = projectIds.length
      ? await db.from("project_activity").select("id,event_type,title,created_at").in("project_id", projectIds).order("created_at", { ascending: false }).limit(100)
      : { data: [], error: null }
    const projectActivityTableMissing = Boolean(projectActivityResult.error && (
      projectActivityResult.error.code === "PGRST205" ||
      projectActivityResult.error.code === "42P01" ||
      String(projectActivityResult.error.message || "").toLowerCase().includes("project_activity")
    ))
    if (projectActivityResult.error && !projectActivityTableMissing) {
      console.error("[Portal] Project activity query failed:", projectActivityResult.error)
      return json({ error: "Project activity is temporarily unavailable." }, 503)
    }
    const activeProjects = projects.filter((project) => ["in_progress", "review"].includes(project.status))
    const recentProjects = projects.slice(0, 4).map((project) => ({
      id: project.id, name: project.name, description: project.description, category: project.category,
      status: project.status, deadline: project.deadline, updated_at: project.updated_at,
    }))
    const recentInvoices = outstandingInvoices.slice(0, 3).map((invoice) => ({
      id: invoice.id, invoice_number: invoice.invoice_number, status: invoice.status,
      currency: invoice.currency, total_minor: invoice.total_minor, due_minor: balanceByInvoice[invoice.id] ?? Number(invoice.total_minor || 0), due_at: invoice.due_at,
    }))
    return json({
      client: clients[0] ?? null,
      projects: { active: activeProjects.length, total: projects.length, recent: recentProjects },
      services: { tracked: !serviceTableMissing, active: serviceTableMissing ? null : (serviceResult.data ?? []).filter((service) => service.status === "active").length },
      billing: { outstanding_by_currency: dueByCurrency, invoices: recentInvoices, outstanding_count: outstandingInvoices.length },
      domains: { count: domains.length, recent: recentDomains },
      conversations: { count: conversations.length },
      notifications: { tracked: !notificationTableMissing, unread_count: notificationTableMissing ? null : (notificationResult.data ?? []).filter((item) => !item.read_at).length },
      activity: [
        ...(projectActivityTableMissing ? [] : (projectActivityResult.data ?? []).map((item) => ({ id: "project-activity-" + item.id, kind: "project", title: item.title, detail: item.event_type.replaceAll("_", " "), at: item.created_at }))),
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
