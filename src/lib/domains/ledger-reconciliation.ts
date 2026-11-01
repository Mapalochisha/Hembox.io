export type DomainLedgerOrder = {
  id: string
  status: string
  customerId: string | null
  currency: string
  billingInvoiceId: string | null
  providerDomainReference?: string | null
  registeredAt?: string | null
}

export type DomainLedgerInvoice = {
  id: string
  customerId: string
  sourceType: string | null
  sourceId: string | null
  status: string
  currency: string
  totalMinor: number
  paidAt: string | null
}

export type DomainLedgerAllocation = {
  amountMinor: number
  currency: string
  allocationType: string
}

export type DomainLedgerPaymentClaim = {
  status: string
  claimedAmountMinor: number
  currency: string
}

export type DomainLedgerIssue =
  | "invoice_link_missing"
  | "invoice_missing"
  | "invoice_source_mismatch"
  | "invoice_customer_mismatch"
  | "invoice_currency_mismatch"
  | "duplicate_domain_invoices"
  | "invoice_paid_without_full_allocations"
  | "invoice_allocation_overrun"
  | "invoice_allocation_currency_mismatch"
  | "order_paid_without_settlement"
  | "paid_invoice_order_not_advanced"
  | "registrant_missing_for_paid_order"
  | "registration_evidence_missing"
  | "payment_claim_pending_review"
  | "payment_claim_currency_mismatch"
  | "legacy_domain_claims_present"

export type DomainLedgerReconciliation = {
  severity: "clear" | "warning" | "critical"
  issues: DomainLedgerIssue[]
  invoiceId: string | null
  invoiceStatus: string | null
  totalMinor: number | null
  allocatedMinor: number
  outstandingMinor: number | null
  pendingClaimCount: number
  legacyClaimCount: number
  registrantPresent: boolean
  recommendedAction: "no_action" | "review_payment_claims" | "review_legacy_payment_evidence" | "manual_review"
}

/**
 * Compare a domain order with the unified billing ledger. This is a read-only
 * diagnostic: it never changes an invoice, allocation, claim or order status.
 */
export function deriveDomainLedgerReconciliation(input: {
  order: DomainLedgerOrder
  invoice: DomainLedgerInvoice | null
  invoiceLinkMatches: boolean
  duplicateInvoiceCount?: number
  allocations?: DomainLedgerAllocation[]
  paymentClaims?: DomainLedgerPaymentClaim[]
  registrantPresent: boolean
  legacyClaimCount?: number
}): DomainLedgerReconciliation {
  const { order, invoice } = input
  const allocations = input.allocations ?? []
  const claims = input.paymentClaims ?? []
  const legacyClaimCount = input.legacyClaimCount ?? 0
  const issues: DomainLedgerIssue[] = []

  if (!order.billingInvoiceId) {
    if (invoice) issues.push("invoice_link_missing")
    else if (["quoted", "awaiting_payment", "payment_confirmed", "registration_pending", "registered"].includes(order.status)) {
      issues.push("invoice_link_missing")
    }
  } else if (!invoice) {
    issues.push("invoice_missing")
  }

  if ((input.duplicateInvoiceCount ?? 0) > 1) issues.push("duplicate_domain_invoices")

  let allocatedMinor = 0
  if (invoice) {
    if (order.billingInvoiceId && !input.invoiceLinkMatches) issues.push("invoice_source_mismatch")
    if (!order.customerId || invoice.customerId !== order.customerId) issues.push("invoice_customer_mismatch")
    if (invoice.sourceType !== "domain_registration" || invoice.sourceId !== order.id) issues.push("invoice_source_mismatch")
    if (invoice.currency !== order.currency) issues.push("invoice_currency_mismatch")

    for (const allocation of allocations) {
      if (allocation.currency !== invoice.currency) issues.push("invoice_allocation_currency_mismatch")
      if (allocation.allocationType === "allocate") allocatedMinor += allocation.amountMinor
      else if (allocation.allocationType === "reverse") allocatedMinor -= allocation.amountMinor
    }

    if (allocatedMinor > invoice.totalMinor) issues.push("invoice_allocation_overrun")
    if (invoice.status === "paid" && (!invoice.paidAt || invoice.totalMinor <= 0 || allocatedMinor < invoice.totalMinor)) {
      issues.push("invoice_paid_without_full_allocations")
    }
    if (invoice.status !== "paid" && invoice.totalMinor > 0 && allocatedMinor >= invoice.totalMinor) {
      issues.push("invoice_paid_without_full_allocations")
    }

    if (["payment_confirmed", "registration_pending", "registered"].includes(order.status)
      && (invoice.status !== "paid" || !invoice.paidAt || allocatedMinor < invoice.totalMinor)) {
      issues.push("order_paid_without_settlement")
    }
    if (invoice.status === "paid" && ["quoted", "awaiting_payment"].includes(order.status)) {
      issues.push("paid_invoice_order_not_advanced")
    }
  }

  if (!input.registrantPresent && ["payment_confirmed", "registration_pending", "registered"].includes(order.status)) {
    issues.push("registrant_missing_for_paid_order")
  }
  if (order.status === "registered" && (
    !order.providerDomainReference?.trim()
    || !order.registeredAt
    || !Number.isFinite(Date.parse(order.registeredAt))
  )) {
    issues.push("registration_evidence_missing")
  }

  const pendingClaimCount = claims.filter((claim) => claim.status === "submitted" || claim.status === "needs_info").length
  if (pendingClaimCount > 0) issues.push("payment_claim_pending_review")
  if (invoice && claims.some((claim) => claim.currency !== invoice.currency)) issues.push("payment_claim_currency_mismatch")
  if (legacyClaimCount > 0) issues.push("legacy_domain_claims_present")

  const criticalIssues = new Set<DomainLedgerIssue>([
    "invoice_link_missing", "invoice_missing", "invoice_source_mismatch", "invoice_customer_mismatch",
    "invoice_currency_mismatch", "duplicate_domain_invoices", "invoice_paid_without_full_allocations",
    "invoice_allocation_overrun", "invoice_allocation_currency_mismatch", "order_paid_without_settlement",
    "paid_invoice_order_not_advanced", "registrant_missing_for_paid_order", "registration_evidence_missing",
    "payment_claim_currency_mismatch",
  ])
  const severity = issues.some((issue) => criticalIssues.has(issue))
    ? "critical"
    : issues.length > 0 ? "warning" : "clear"

  const recommendedAction = severity === "critical"
    ? "manual_review"
    : pendingClaimCount > 0
      ? "review_payment_claims"
      : legacyClaimCount > 0
        ? "review_legacy_payment_evidence"
        : "no_action"

  return {
    severity,
    issues: Array.from(new Set(issues)),
    invoiceId: invoice?.id ?? null,
    invoiceStatus: invoice?.status ?? null,
    totalMinor: invoice?.totalMinor ?? null,
    allocatedMinor,
    outstandingMinor: invoice ? Math.max(0, invoice.totalMinor - allocatedMinor) : null,
    pendingClaimCount,
    legacyClaimCount,
    registrantPresent: input.registrantPresent,
    recommendedAction,
  }
}
