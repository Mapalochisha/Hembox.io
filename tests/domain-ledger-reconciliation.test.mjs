import assert from "node:assert/strict"
import test from "node:test"
import { deriveDomainLedgerReconciliation } from "../src/lib/domains/ledger-reconciliation.ts"

const order = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  status: "payment_confirmed",
  customerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  currency: "ZMW",
  billingInvoiceId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  providerDomainReference: null,
  registeredAt: null,
}
const invoice = {
  id: order.billingInvoiceId,
  customerId: order.customerId,
  sourceType: "domain_registration",
  sourceId: order.id,
  status: "paid",
  currency: "ZMW",
  totalMinor: 30000,
  paidAt: "2026-11-01T10:00:00.000Z",
}
const allocation = [{ amountMinor: 30000, currency: "ZMW", allocationType: "allocate" }]

test("a fully settled invoice with matching order and registrant is clear", () => {
  const result = deriveDomainLedgerReconciliation({
    order, invoice, invoiceLinkMatches: true, allocations: allocation, registrantPresent: true,
  })
  assert.equal(result.severity, "clear")
  assert.deepEqual(result.issues, [])
  assert.equal(result.allocatedMinor, 30000)
  assert.equal(result.outstandingMinor, 0)
  assert.equal(result.recommendedAction, "no_action")
})

test("missing invoice link is critical for an order that has advanced to payment", () => {
  const result = deriveDomainLedgerReconciliation({
    order: { ...order, billingInvoiceId: null }, invoice: null, invoiceLinkMatches: false, registrantPresent: true,
  })
  assert.equal(result.severity, "critical")
  assert.ok(result.issues.includes("invoice_link_missing"))
  assert.equal(result.recommendedAction, "manual_review")
})

test("a linked invoice must match the order, customer and currency", () => {
  const result = deriveDomainLedgerReconciliation({
    order,
    invoice: { ...invoice, customerId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", currency: "USD", sourceId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" },
    invoiceLinkMatches: false,
    allocations: allocation,
    registrantPresent: true,
  })
  assert.ok(result.issues.includes("invoice_source_mismatch"))
  assert.ok(result.issues.includes("invoice_customer_mismatch"))
  assert.ok(result.issues.includes("invoice_currency_mismatch"))
  assert.equal(result.severity, "critical")
})

test("a paid invoice without full net allocations is flagged", () => {
  const result = deriveDomainLedgerReconciliation({
    order,
    invoice,
    invoiceLinkMatches: true,
    allocations: [{ amountMinor: 20000, currency: "ZMW", allocationType: "allocate" }],
    registrantPresent: true,
  })
  assert.ok(result.issues.includes("invoice_paid_without_full_allocations"))
  assert.ok(result.issues.includes("order_paid_without_settlement"))
  assert.equal(result.outstandingMinor, 10000)
})

test("reversals reduce net allocation and over-allocation is critical", () => {
  const reversed = deriveDomainLedgerReconciliation({
    order,
    invoice,
    invoiceLinkMatches: true,
    allocations: [
      { amountMinor: 30000, currency: "ZMW", allocationType: "allocate" },
      { amountMinor: 5000, currency: "ZMW", allocationType: "reverse" },
    ],
    registrantPresent: true,
  })
  assert.equal(reversed.allocatedMinor, 25000)
  assert.ok(reversed.issues.includes("invoice_paid_without_full_allocations"))

  const over = deriveDomainLedgerReconciliation({
    order,
    invoice,
    invoiceLinkMatches: true,
    allocations: [{ amountMinor: 35000, currency: "ZMW", allocationType: "allocate" }],
    registrantPresent: true,
  })
  assert.ok(over.issues.includes("invoice_allocation_overrun"))
  assert.equal(over.severity, "critical")
})

test("a settled invoice that has not advanced its order is flagged", () => {
  const result = deriveDomainLedgerReconciliation({
    order: { ...order, status: "awaiting_payment" },
    invoice,
    invoiceLinkMatches: true,
    allocations: allocation,
    registrantPresent: true,
  })
  assert.ok(result.issues.includes("paid_invoice_order_not_advanced"))
})

test("registrant and registration evidence are required for advanced states", () => {
  const missingRegistrant = deriveDomainLedgerReconciliation({
    order,
    invoice,
    invoiceLinkMatches: true,
    allocations: allocation,
    registrantPresent: false,
  })
  assert.ok(missingRegistrant.issues.includes("registrant_missing_for_paid_order"))

  const missingRegistrationEvidence = deriveDomainLedgerReconciliation({
    order: { ...order, status: "registered" },
    invoice,
    invoiceLinkMatches: true,
    allocations: allocation,
    registrantPresent: true,
  })
  assert.ok(missingRegistrationEvidence.issues.includes("registration_evidence_missing"))
})

test("pending billing claims and legacy claims are visible as warnings", () => {
  const result = deriveDomainLedgerReconciliation({
    order: { ...order, status: "awaiting_payment" },
    invoice: { ...invoice, status: "unpaid", paidAt: null },
    invoiceLinkMatches: true,
    allocations: [],
    paymentClaims: [{ status: "submitted", claimedAmountMinor: 30000, currency: "ZMW" }],
    registrantPresent: true,
    legacyClaimCount: 1,
  })
  assert.equal(result.severity, "warning")
  assert.ok(result.issues.includes("payment_claim_pending_review"))
  assert.ok(result.issues.includes("legacy_domain_claims_present"))
  assert.equal(result.recommendedAction, "review_payment_claims")
})
