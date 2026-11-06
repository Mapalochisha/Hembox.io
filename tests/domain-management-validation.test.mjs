import test from "node:test"
import assert from "node:assert/strict"
import {
  canManageDomainOrder,
  normalizeNameservers,
  normalizeRenewalYears,
} from "../src/lib/domains/management.ts"

test("nameservers are normalized to lowercase and trailing dots are removed", () => {
  const result = normalizeNameservers([" NS1.Example.COM. ", "ns2.example.com"])
  assert.equal(result.ok, true)
  assert.deepEqual(result.ok && result.nameservers, ["ns1.example.com", "ns2.example.com"])
})

test("fewer than two or more than eight nameservers are refused", () => {
  assert.equal(normalizeNameservers(["ns1.example.com"]).ok, false)
  assert.equal(normalizeNameservers(Array.from({ length: 9 }, (_, i) => `ns${i + 1}.example.com`)).ok, false)
})

test("duplicate nameservers are refused even when differently cased", () => {
  const result = normalizeNameservers(["ns1.example.com", "NS1.example.com"])
  assert.equal(result.ok, false)
  assert.match(result.ok ? "" : result.message, /unique/)
})

test("invalid hostnames, IP addresses and blank entries are refused", () => {
  for (const bad of ["ns1", "192.168.0.1", "ns_1.example.com", "-ns1.example.com", "ns1..example.com"]) {
    assert.equal(normalizeNameservers([bad, "ns2.example.com"]).ok, false, bad)
  }
  assert.equal(normalizeNameservers(["ns1.example.com", "  "]).ok, false)
})

test("non-array nameserver input is refused", () => {
  assert.equal(normalizeNameservers("ns1.example.com").ok, false)
  assert.equal(normalizeNameservers(undefined).ok, false)
})

test("renewal years must be whole numbers from 1 through 10", () => {
  assert.deepEqual(normalizeRenewalYears(1), { ok: true, years: 1 })
  assert.deepEqual(normalizeRenewalYears("3"), { ok: true, years: 3 })
  for (const bad of [0, 11, 1.5, "abc", null, -1, undefined]) {
    assert.equal(normalizeRenewalYears(bad).ok, false, String(bad))
  }
})

test("only registered domains can be managed", () => {
  assert.equal(canManageDomainOrder("registered"), true)
  for (const status of ["enquiry", "quoted", "awaiting_payment", "payment_confirmed", "registration_pending", "registration_failed", "cancelled", "refunded", "manual_review"]) {
    assert.equal(canManageDomainOrder(status), false, status)
  }
})
