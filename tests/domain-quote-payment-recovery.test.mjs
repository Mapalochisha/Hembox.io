import test from "node:test"
import assert from "node:assert/strict"
import { createDomainQuoteSnapshot, isDomainQuoteUsable } from "../src/lib/domains/quotes.ts"
import {
  DomainPaymentsDisabledError,
  disabledDomainPaymentProvider,
  getDomainPaymentProvider,
  isVerifiedPaymentForOrder,
} from "../src/lib/domains/payment-provider.ts"
import { getDomainRecoveryAction } from "../src/lib/domains/recovery.ts"

const now = Date.parse("2026-10-19T10:00:00.000Z")
const quoteInput = {
  domainName: " Example.COM ",
  currency: "ZMW",
  registrationPriceMinor: 15000,
  renewalPriceMinor: 18000,
  termYears: 1,
  pricingSource: "admin-verified-price-snapshot",
  pricingCapturedAt: "2026-10-19T09:00:00.000Z",
  now,
}

test("quote snapshot normalizes domain, preserves renewal separately and expires", () => {
  const quote = createDomainQuoteSnapshot(quoteInput)
  assert.equal(quote.domainName, "example.com")
  assert.equal(quote.totalDueMinor, 15000)
  assert.equal(quote.renewalPriceMinor, 18000)
  assert.equal(isDomainQuoteUsable(quote, now), true)
  assert.equal(isDomainQuoteUsable(quote, Date.parse(quote.expiresAt)), false)
  assert.equal(Object.isFrozen(quote), true)
})

test("quote creation rejects stale prices, invalid currency and unsafe totals", () => {
  assert.throws(
    () => createDomainQuoteSnapshot({ ...quoteInput, pricingCapturedAt: "2026-10-17T00:00:00.000Z" }),
    /stale or from the future/,
  )
  assert.throws(
    () => createDomainQuoteSnapshot({ ...quoteInput, currency: "USD" }),
    /Only ZMW/,
  )
  assert.throws(
    () => createDomainQuoteSnapshot({ ...quoteInput, registrationPriceMinor: Number.MAX_SAFE_INTEGER, termYears: 2 }),
    /safe integer/,
  )
  assert.throws(
    () => createDomainQuoteSnapshot({ ...quoteInput, validityMs: 60 * 60 * 1000 + 1 }),
    /between 1 ms and 60 minutes/,
  )
})

test("quote cannot be used before creation or after expiry", () => {
  const quote = createDomainQuoteSnapshot(quoteInput)
  assert.equal(isDomainQuoteUsable(quote, now - 1), false)
  assert.equal(isDomainQuoteUsable(quote, now + 15 * 60 * 1000), false)
})

test("payment provider defaults to disabled and unknown modes fail closed", async () => {
  assert.equal(getDomainPaymentProvider().id, "disabled")
  assert.equal(getDomainPaymentProvider("disabled"), disabledDomainPaymentProvider)
  assert.throws(() => getDomainPaymentProvider("stripe"), DomainPaymentsDisabledError)
  await assert.rejects(
    disabledDomainPaymentProvider.createIntent({
      orderId: "order-1",
      idempotencyKey: "idem-1",
      amountMinor: 15000,
      currency: "ZMW",
      returnUrl: "https://hembox.io/profile/domains",
    }),
    DomainPaymentsDisabledError,
  )
  await assert.rejects(
    disabledDomainPaymentProvider.verifyWebhook("{}", new Headers()),
    DomainPaymentsDisabledError,
  )
})

test("payment evidence must match provider, exact amount and currency", () => {
  const event = {
    provider: "example-gateway",
    eventId: "evt-1",
    providerPaymentId: "pay-1",
    status: "confirmed",
    amountMinor: 15000,
    currency: "ZMW",
    verified: true,
  }
  assert.equal(isVerifiedPaymentForOrder(event, {
    provider: "example-gateway",
    amountMinor: 15000,
    currency: "ZMW",
  }), true)
  assert.equal(isVerifiedPaymentForOrder({ ...event, amountMinor: 14999 }, {
    provider: "example-gateway",
    amountMinor: 15000,
    currency: "ZMW",
  }), false)
  assert.equal(isVerifiedPaymentForOrder({ ...event, verified: false }, {
    provider: "example-gateway",
    amountMinor: 15000,
    currency: "ZMW",
  }), false)
})

test("ambiguous registration outcomes require lookup before any retry", () => {
  assert.equal(getDomainRecoveryAction({
    status: "registration_pending",
    payment: "confirmed",
    registration: "ambiguous",
  }), "retry_registration_status_lookup")
  assert.equal(getDomainRecoveryAction({
    status: "registration_failed",
    payment: "confirmed",
    registration: "confirmed_not_registered",
  }), "eligible_for_registration_retry_after_reconciliation")
})

test("expired quotes and inconsistent payment states are flagged conservatively", () => {
  assert.equal(getDomainRecoveryAction({
    status: "awaiting_payment",
    quoteExpired: true,
    payment: "pending",
    registration: "not_started",
  }), "review_expired_quote")
  assert.equal(getDomainRecoveryAction({
    status: "payment_confirmed",
    payment: "unknown",
    registration: "not_started",
  }), "inconsistent_state_review")
  assert.equal(getDomainRecoveryAction({
    status: "registered",
    payment: "confirmed",
    registration: "ambiguous",
  }), "inconsistent_state_review")
})
