import test from "node:test"
import assert from "node:assert/strict"
import { createDomainQuoteSnapshot, isDomainQuoteUsable } from "../src/lib/domains/quotes.ts"
import {
  DomainPaymentsDisabledError,
  disabledDomainPaymentProvider,
  getDomainPaymentProvider,
  isVerifiedPaymentForOrder,
} from "../src/lib/domains/payment-provider.ts"
import { deriveRegistrationReconciliationState, getDomainRecoveryAction } from "../src/lib/domains/recovery.ts"

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

test("payment evidence must match provider, confirmed status, exact amount and currency", () => {
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
  assert.equal(isVerifiedPaymentForOrder({ ...event, status: "failed" }, { provider: "example-gateway", amountMinor: 15000, currency: "ZMW" }), false)
})


test("registration recovery requires provider evidence instead of trusting local status alone", () => {
  assert.equal(deriveRegistrationReconciliationState({
    orderStatus: "registered",
    registeredAt: "2026-10-19T10:00:00.000Z",
    providerDomainReference: null,
  }), "ambiguous")
  assert.equal(deriveRegistrationReconciliationState({
    orderStatus: "registered",
    registeredAt: "not-a-date",
    providerDomainReference: "registrar-domain-123",
  }), "ambiguous")
  assert.equal(deriveRegistrationReconciliationState({
    orderStatus: "registered",
    registeredAt: "2026-10-19T10:00:00.000Z",
    providerDomainReference: " registrar-domain-123 ",
  }), "confirmed_registered")
  assert.equal(deriveRegistrationReconciliationState({
    orderStatus: "registration_failed",
  }), "ambiguous")
  assert.equal(deriveRegistrationReconciliationState({
    orderStatus: "registration_pending",
  }), "ambiguous")
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
    payment: "not_started",
    registration: "not_started",
  }), "reconcile_payment")
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


import {
  DomainQuotePreparationError,
  prepareLiveDomainQuote,
  validateDomainQuotePricing,
} from "../src/lib/domains/quote-service.ts"

const quotePolicyNow = Date.parse("2026-10-23T10:00:00.000Z")

function quotePolicyProvider(overrides = {}) {
  return {
    id: "namesilo",
    environment: "live",
    capabilities: {
      availabilitySearch: true,
      registration: false,
      renewal: false,
      transfers: false,
      dnsManagement: false,
      privacyProtection: false,
    },
    ...overrides,
  }
}

function quotePolicyCatalog(overrides = {}) {
  return {
    tld: ".com",
    enabled: true,
    provider_id: "namesilo",
    wholesale_currency: "USD",
    registration_wholesale_minor: 1000,
    renewal_wholesale_minor: 1200,
    retail_currency: "ZMW",
    registration_retail_minor: 30000,
    renewal_retail_minor: 36000,
    wholesale_fx_rate_micros: 25000000,
    margin_basis_points: 2000,
    pricing_source: "provider-price-sheet-and-fx-snapshot",
    price_updated_at: new Date(quotePolicyNow - 60 * 60 * 1000).toISOString(),
    ...overrides,
  }
}

function quotePolicyAvailability(overrides = {}) {
  return {
    domain: "example.com",
    availability: "available",
    registrationPrice: null,
    renewalPrice: null,
    checkedAt: new Date(quotePolicyNow).toISOString(),
    source: "namesilo",
    ...overrides,
  }
}

test("live quote preparation validates fresh costs and persists a traceable one-year price", () => {
  const pricing = validateDomainQuotePricing({
    domainName: " Example.COM ",
    catalog: quotePolicyCatalog(),
    provider: quotePolicyProvider(),
    now: quotePolicyNow,
  })
  const prepared = prepareLiveDomainQuote({
    pricing,
    availabilityResult: quotePolicyAvailability(),
    now: quotePolicyNow,
  })

  assert.equal(prepared.quote.domainName, "example.com")
  assert.equal(prepared.quote.currency, "ZMW")
  assert.equal(prepared.quote.registrationPriceMinor, 30000)
  assert.equal(prepared.quote.renewalPriceMinor, 36000)
  assert.equal(prepared.quote.totalDueMinor, 30000)
  assert.equal(prepared.quote.termYears, 1)
  assert.equal(prepared.providerId, "namesilo")
  assert.equal(prepared.availabilityCheckedAt, new Date(quotePolicyNow).toISOString())
  assert.deepEqual(prepared.pricingBasis, {
    wholesaleCurrency: "USD",
    registrationWholesaleMinor: 1000,
    renewalWholesaleMinor: 1200,
    fxRateMicros: 25000000,
    marginBasisPoints: 2000,
  })
})

test("live quote preparation refuses sandbox and mock providers", () => {
  assert.throws(() => validateDomainQuotePricing({
    domainName: "example.com",
    catalog: quotePolicyCatalog(),
    provider: quotePolicyProvider({ environment: "test" }),
    now: quotePolicyNow,
  }), (error) => error instanceof DomainQuotePreparationError && error.code === "live_provider_required")

  assert.throws(() => validateDomainQuotePricing({
    domainName: "example.com",
    catalog: quotePolicyCatalog(),
    provider: quotePolicyProvider({ environment: "mock" }),
    now: quotePolicyNow,
  }), (error) => error instanceof DomainQuotePreparationError && error.code === "live_provider_required")
})

test("live quote preparation refuses missing, disabled, stale, or mismatched catalogue data", () => {
  const provider = quotePolicyProvider()
  assert.throws(() => validateDomainQuotePricing({
    domainName: "example.com", catalog: null, provider, now: quotePolicyNow,
  }), (error) => error instanceof DomainQuotePreparationError && error.code === "price_unavailable")

  assert.throws(() => validateDomainQuotePricing({
    domainName: "example.com", catalog: quotePolicyCatalog({ enabled: false }), provider, now: quotePolicyNow,
  }), (error) => error instanceof DomainQuotePreparationError && error.code === "price_unavailable")

  assert.throws(() => validateDomainQuotePricing({
    domainName: "example.com",
    catalog: quotePolicyCatalog({ price_updated_at: new Date(quotePolicyNow - 25 * 60 * 60 * 1000).toISOString() }),
    provider,
    now: quotePolicyNow,
  }), (error) => error instanceof DomainQuotePreparationError && error.code === "price_stale")

  assert.throws(() => validateDomainQuotePricing({
    domainName: "example.com", catalog: quotePolicyCatalog({ provider_id: "other-provider" }), provider, now: quotePolicyNow,
  }), (error) => error instanceof DomainQuotePreparationError && error.code === "provider_price_mismatch")

  assert.throws(() => validateDomainQuotePricing({
    domainName: "example.net", catalog: quotePolicyCatalog(), provider, now: quotePolicyNow,
  }), (error) => error instanceof DomainQuotePreparationError && error.code === "catalog_tld_mismatch")
})

test("live quote preparation recomputes stored retail values from wholesale, FX, and margin", () => {
  assert.throws(() => validateDomainQuotePricing({
    domainName: "example.com",
    catalog: quotePolicyCatalog({ registration_retail_minor: 25000 }),
    provider: quotePolicyProvider(),
    now: quotePolicyNow,
  }), (error) => error instanceof DomainQuotePreparationError && error.code === "price_snapshot_mismatch")

  assert.throws(() => validateDomainQuotePricing({
    domainName: "example.com",
    catalog: quotePolicyCatalog({ retail_currency: "USD" }),
    provider: quotePolicyProvider(),
    now: quotePolicyNow,
  }), (error) => error instanceof DomainQuotePreparationError && error.code === "invalid_price_currency")
})

test("live quote preparation fails closed on unavailable, unknown, mismatched, and stale registrar results", () => {
  const pricing = validateDomainQuotePricing({
    domainName: "example.com",
    catalog: quotePolicyCatalog(),
    provider: quotePolicyProvider(),
    now: quotePolicyNow,
  })

  assert.throws(() => prepareLiveDomainQuote({
    pricing, availabilityResult: quotePolicyAvailability({ availability: "unavailable" }), now: quotePolicyNow,
  }), (error) => error instanceof DomainQuotePreparationError && error.code === "domain_unavailable")

  assert.throws(() => prepareLiveDomainQuote({
    pricing, availabilityResult: quotePolicyAvailability({ availability: "unknown" }), now: quotePolicyNow,
  }), (error) => error instanceof DomainQuotePreparationError && error.code === "availability_unconfirmed")

  assert.throws(() => prepareLiveDomainQuote({
    pricing, availabilityResult: quotePolicyAvailability({ domain: "other.com" }), now: quotePolicyNow,
  }), (error) => error instanceof DomainQuotePreparationError && error.code === "availability_response_mismatch")

  assert.throws(() => prepareLiveDomainQuote({
    pricing, availabilityResult: quotePolicyAvailability({ source: "mock" }), now: quotePolicyNow,
  }), (error) => error instanceof DomainQuotePreparationError && error.code === "availability_response_mismatch")

  assert.throws(() => prepareLiveDomainQuote({
    pricing,
    availabilityResult: quotePolicyAvailability({ checkedAt: new Date(quotePolicyNow - 61 * 1000).toISOString() }),
    now: quotePolicyNow,
  }), (error) => error instanceof DomainQuotePreparationError && error.code === "availability_stale")
})
