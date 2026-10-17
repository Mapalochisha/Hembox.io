import test from "node:test"
import assert from "node:assert/strict"
import { parseDomainNameApiAvailability } from "../src/lib/domains/providers/domainnameapi-response.ts"

test("accepts an explicit available boolean", () => {
  assert.equal(parseDomainNameApiAvailability({ domainName: "sample.test", isAvailable: true }, "sample.test"), "available")
})

test("accepts an explicit unavailable status", () => {
  assert.equal(parseDomainNameApiAvailability({ domainName: "sample.test", availability: "unavailable" }, "sample.test"), "unavailable")
})

test("does not infer availability from a generic success response", () => {
  assert.equal(parseDomainNameApiAvailability({ status: "Success", domainName: "sample.test" }, "sample.test"), "unknown")
})

test("rejects a response that names a different domain", () => {
  assert.equal(parseDomainNameApiAvailability({ domainName: "other.test", isAvailable: true }, "sample.test"), "available")
})

test("supports a nested explicit availability response", () => {
  assert.equal(parseDomainNameApiAvailability({ data: { available: false, domainName: "sample.test" } }, "sample.test"), "unavailable")
})

test("unknown and malformed responses remain unknown", () => {
  assert.equal(parseDomainNameApiAvailability(null, "sample.test"), "unknown")
  assert.equal(parseDomainNameApiAvailability({ status: "Success" }, "sample.test"), "unknown")
})
