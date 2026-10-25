import test from "node:test"
import assert from "node:assert/strict"
import { parseDomainSearchRequest } from "../src/lib/domains/validation.ts"

test("trims and lowercases domain names before provider calls", () => {
  const result = parseDomainSearchRequest({ domains: ["  Example.COM  "] })
  assert.deepEqual(result, { success: true, data: { domains: ["example.com"] } })
})

test("collapses duplicate domains after normalization", () => {
  const result = parseDomainSearchRequest({ domains: ["Example.com", " example.COM ", "other.org"] })
  assert.deepEqual(result, { success: true, data: { domains: ["example.com", "other.org"] } })
})

test("rejects empty batches and batches above the limit", () => {
  assert.equal(parseDomainSearchRequest({ domains: [] }).success, false)
  assert.equal(parseDomainSearchRequest({ domains: Array.from({ length: 11 }, (_, i) => `domain${i}.com`) }).success, false)
})

test("rejects malformed domains and URL-like input", () => {
  for (const domain of ["example", "-bad.com", "bad-.com", "bad..com", "https://example.com", "example.com/path"]) {
    assert.equal(parseDomainSearchRequest({ domains: [domain] }).success, false, domain)
  }
})

test("rejects labels over 63 characters and names over 253 characters", () => {
  assert.equal(parseDomainSearchRequest({ domains: [`${"a".repeat(64)}.com`] }).success, false)
  const tooLong = [`${"a".repeat(63)}.${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(62)}`]
  assert.equal(parseDomainSearchRequest({ domains: tooLong }).success, false)
})

test("rejects extra request properties", () => {
  assert.equal(parseDomainSearchRequest({ domains: ["example.com"], live: true }).success, false)
})
