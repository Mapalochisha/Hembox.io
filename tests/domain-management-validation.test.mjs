import test from "node:test"
import assert from "node:assert/strict"
import {
  canManageDomainOrder,
  normalizeNameservers,
  normalizeRenewalYears,
} from "../src/lib/domains/management.ts"

test("a nameserver list is lower-cased, trimmed and de-duplicated by rejection", () => {
  const result = normalizeNameservers([" NS1.Example.COM. ", "ns2.example.com"])
  assert.equal(result.ok, true)
  assert.deepEqual(result.ok && result.nameservers, ["ns1.example.com", "ns2.example.com"])
})

test("fewer than two nameservers is refused", () => {
  const result = normalizeNameservers(["ns1.example.com"])
  assert.equal(result.ok, false)
  assert.match(result.ok ? "" : result.message, /between 2 and 8/)
})

test("more than eight nameservers is refused", () => {
  const result = normalizeNameservers(Array.from({ length: 9 }, (_, index) => `ns${index + 1}.example.com`))
  assert.equal(result.ok, false)
})

test("duplicate nameservers are refused even when differently cased", () => {
  const result = normalizeNameservers(["ns1.example.com", "NS1.example.com"])
  assert.equal(result.ok, false)
  assert.match(result.ok ? "" : result.message, /unique/)
})

test("non-hostname nameservers are refused", () => {
  for (const bad of ["ns1", "192.168.0.1", "ns_1.example.com", "-ns1.example.com", "ns1..example.com"]) {
    const result = normalizeNameservers([bad, "ns2.example.com"])
    assert.equal(result.ok, false, bad)
  }
})

test("blank entries do not silently shrink the submitted list", () => {
  const result = normalizeNameservers(["ns1.example.com", "  "])
  assert.equal(result.ok, false)
})

test("non-array input is refused", () => {
  assert.equal(normalizeNameservers("ns1.example.com").ok, false)
  assert.equal(normalizeNameservers(undefined).ok, false)
})

test("renewal years must be a whole number from 1 to 10", () => {
  assert.deepEqual(normalizeRenewalYears(1), { ok: true, years: 1 })
  assert.deepEqual(normalizeRenewalYears("3"), { ok: true, years: 3 })
  for (const bad of [0, 11, 1.5, "abc", null, -1]) {
    assert.equal(normalizeRenewalYears(bad).ok, false, String(bad))
  }
})

test("only a registered order can be managed", () => {
  assert.equal(canManageDomainOrder("registered"), true)
  for (const status of [
    "enquiry",
    "quoted",
    "awaiting_payment",
    "payment_confirmed",
    "registration_pending",
    "registration_failed",
    "cancelled",
    "refunded",
    "manual_review",
  ]) {
    assert.equal(canManageDomainOrder(status), false, status)
  }
}
