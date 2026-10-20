import test from "node:test"
import assert from "node:assert/strict"
import {
  DOMAIN_ORDER_STATUSES,
  canTransitionDomainOrder,
  getAllowedDomainOrderTransitions,
} from "../src/lib/domains/order-state.ts"

test("every order status permits an idempotent same-status update", () => {
  for (const status of DOMAIN_ORDER_STATUSES) {
    assert.equal(canTransitionDomainOrder(status, status), true, status)
  }
})

test("the normal enquiry-to-registration lifecycle is allowed", () => {
  const path = [
    ["enquiry", "quoted"],
    ["quoted", "awaiting_payment"],
    ["awaiting_payment", "payment_confirmed"],
    ["payment_confirmed", "registration_pending"],
    ["registration_pending", "registered"],
  ]

  for (const [current, next] of path) {
    assert.equal(canTransitionDomainOrder(current, next), true, `${current} -> ${next}`)
  }
})

test("orders cannot skip payment or registration states", () => {
  assert.equal(canTransitionDomainOrder("enquiry", "payment_confirmed"), false)
  assert.equal(canTransitionDomainOrder("quoted", "registered"), false)
  assert.equal(canTransitionDomainOrder("awaiting_payment", "registration_pending"), false)
  assert.equal(canTransitionDomainOrder("payment_confirmed", "registered"), false)
})

test("cancelled and refunded orders are terminal", () => {
  for (const terminal of ["cancelled", "refunded"]) {
    for (const next of DOMAIN_ORDER_STATUSES) {
      assert.equal(canTransitionDomainOrder(terminal, next), next === terminal, `${terminal} -> ${next}`)
    }
  }
})

test("registration failure only allows explicit recovery paths", () => {
  assert.deepEqual(
    [...getAllowedDomainOrderTransitions("registration_failed")],
    ["registration_pending", "refunded", "cancelled", "manual_review"],
  )
  assert.equal(canTransitionDomainOrder("registration_failed", "registered"), false)
})

test("manual review can only exit through explicitly listed recovery states", () => {
  const allowed = getAllowedDomainOrderTransitions("manual_review")
  assert.equal(canTransitionDomainOrder("manual_review", "registered"), allowed.includes("registered"))
  assert.equal(canTransitionDomainOrder("manual_review", "enquiry"), false)
})
