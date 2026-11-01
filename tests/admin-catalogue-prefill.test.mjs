import test from "node:test"
import assert from "node:assert/strict"
import { buildCataloguePrefill, MAX_WHOLESALE_MINOR } from "../src/lib/domains/admin-catalogue-prefill.ts"

function params(overrides = {}) {
  return new URLSearchParams({
    tld: ".com",
    provider: "namesilo",
    currency: "USD",
    environment: "test",
    fetchedAt: "2026-11-01T14:30:00.000Z",
    registrationWholesaleMinor: "1729",
    renewalWholesaleMinor: "1799",
    ...overrides,
  })
}

test("builds a prefill from a sandbox reference and marks the provenance as test", () => {
  const result = buildCataloguePrefill(params())
  assert.ok(result)
  assert.equal(result.prefill.tld, ".com")
  assert.equal(result.prefill.providerId, "namesilo")
  assert.equal(result.prefill.wholesaleCurrency, "USD")
  assert.equal(result.prefill.registrationWholesaleMinor, "1729")
  assert.equal(result.prefill.renewalWholesaleMinor, "1799")
  assert.equal(result.prefill.pricingSource, "namesilo-standard:test:2026-11-01T14:30:00.000Z")
  assert.equal(result.environment, "test")
  assert.match(result.warnings.join(" "), /OTE sandbox rates/)
})

test("never enables a TLD and never supplies FX or markup, even when the link asks", () => {
  const result = buildCataloguePrefill(params({ enabled: "true", fxRateMicros: "25000000", marginBasisPoints: "9000" }))
  assert.ok(result)
  assert.equal("enabled" in result.prefill, false)
  assert.equal("fxRateMicros" in result.prefill, false)
  assert.equal("marginBasisPoints" in result.prefill, false)
  assert.match(result.warnings.join(" "), /Nothing is saved or published/)
})

test("live references are accepted without the sandbox warning", () => {
  const result = buildCataloguePrefill(params({ environment: "live" }))
  assert.ok(result)
  assert.equal(result.environment, "live")
  assert.equal(result.prefill.pricingSource, "namesilo-standard:live:2026-11-01T14:30:00.000Z")
  assert.doesNotMatch(result.warnings.join(" "), /OTE sandbox rates/)
})

test("normalises a bare or dotted TLD and rejects unsafe ones", () => {
  assert.equal(buildCataloguePrefill(params({ tld: "com" }))?.prefill.tld, ".com")
  assert.equal(buildCataloguePrefill(params({ tld: "..CO.UK" }))?.prefill.tld, ".co.uk")
  for (const tld of ["", ".", "c", "com.", "co m", "com/us", "<script>"]) {
    assert.equal(buildCataloguePrefill(params({ tld })), null, `expected ${JSON.stringify(tld)} to be rejected`)
  }
})

test("rejects costs that are missing, zero, negative, fractional or absurd", () => {
  for (const value of ["", "0", "-1729", "17.29", "1e5", "abc", String(MAX_WHOLESALE_MINOR + 1)]) {
    assert.equal(buildCataloguePrefill(params({ registrationWholesaleMinor: value })), null, `expected registration ${JSON.stringify(value)} to be rejected`)
    assert.equal(buildCataloguePrefill(params({ renewalWholesaleMinor: value })), null, `expected renewal ${JSON.stringify(value)} to be rejected`)
  }
  const missing = params()
  missing.delete("renewalWholesaleMinor")
  assert.equal(buildCataloguePrefill(missing), null)
})

test("rejects an unknown environment, provider or currency, and an unusable timestamp", () => {
  assert.equal(buildCataloguePrefill(params({ environment: "sandbox" })), null)
  assert.equal(buildCataloguePrefill(params({ provider: "domainnameapi" })), null)
  assert.equal(buildCataloguePrefill(params({ currency: "ZMW" })), null)
  assert.equal(buildCataloguePrefill(params({ fetchedAt: "yesterday" })), null)
  assert.equal(buildCataloguePrefill(params({ fetchedAt: "" })), null)
  assert.equal(buildCataloguePrefill(null), null)
})
