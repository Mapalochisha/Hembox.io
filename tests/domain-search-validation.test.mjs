import test from "node:test"
import assert from "node:assert/strict"
import {
  buildDomainSearchCandidates,
  chunkDomainNames,
  parseDomainSearchQuery,
  parseDomainSearchRequest,
} from "../src/lib/domains/validation.ts"

test("accepts a bare name and normalizes case and whitespace", () => {
  const result = parseDomainSearchQuery({ query: "  Hembox  " })
  assert.deepEqual(result, {
    success: true,
    data: { query: "hembox", baseName: "hembox", exactDomain: null },
  })
})

test("accepts a fully-qualified domain with multi-label extensions", () => {
  const result = parseDomainSearchQuery({ query: " HEMBOX.CO.ZM " })
  assert.deepEqual(result, {
    success: true,
    data: { query: "hembox.co.zm", baseName: "hembox", exactDomain: "hembox.co.zm" },
  })
})

test("rejects URLs, paths, malformed labels and unexpected properties", () => {
  for (const query of ["", "https://example.com", "example.com/path", "bad..name", "-bad", "bad-", "bad name", ".com", "a".repeat(64)]) {
    assert.equal(parseDomainSearchQuery({ query }).success, false, query)
  }
  assert.equal(parseDomainSearchQuery({ query: "example", extra: true }).success, false)
})

test("builds candidates from enabled catalogue TLDs for a bare name", () => {
  const parsed = parseDomainSearchQuery({ query: "Hembox" })
  assert.equal(parsed.success, true)
  if (!parsed.success) return

  assert.deepEqual(
    buildDomainSearchCandidates(parsed.data, [".com", ".net", ".org", ".co.zm"]),
    {
      exactSupported: null,
      candidates: ["hembox.com", "hembox.net", "hembox.org", "hembox.co.zm"],
    },
  )
})

test("supports multi-label TLDs in generated alternatives", () => {
  const parsed = parseDomainSearchQuery({ query: "hembox" })
  assert.equal(parsed.success, true)
  if (!parsed.success) return
  assert.deepEqual(buildDomainSearchCandidates(parsed.data, [".com", ".co.zm"]), {
    exactSupported: null,
    candidates: ["hembox.com", "hembox.co.zm"],
  })
})

test("puts the exact supported domain first before alternatives", () => {
  const parsed = parseDomainSearchQuery({ query: "hembox.tech" })
  assert.equal(parsed.success, true)
  if (!parsed.success) return

  assert.deepEqual(
    buildDomainSearchCandidates(parsed.data, [".com", ".tech", ".net"]),
    {
      exactSupported: true,
      candidates: ["hembox.tech", "hembox.com", "hembox.net"],
    },
  )
})

test("does not send unsupported exact extensions to the registrar", () => {
  const parsed = parseDomainSearchQuery({ query: "hembox.xyz" })
  assert.equal(parsed.success, true)
  if (!parsed.success) return

  assert.deepEqual(
    buildDomainSearchCandidates(parsed.data, [".com", ".net"]),
    { exactSupported: false, candidates: ["hembox.com", "hembox.net"] },
  )
})

test("chunks candidate domains into batches of at most ten", () => {
  const domains = Array.from({ length: 23 }, (_, index) => `domain${index}.com`)
  const batches = chunkDomainNames(domains)
  assert.deepEqual(batches.map((batch) => batch.length), [10, 10, 3])
  assert.deepEqual(batches.flat(), domains)
})

test("rejects invalid batch sizes", () => {
  assert.throws(() => chunkDomainNames(["example.com"], 0), /positive integer/)
})

test("legacy explicit-domain validator remains compatible", () => {
  const result = parseDomainSearchRequest({ domains: ["  Example.COM  ", "example.com", "other.org"] })
  assert.deepEqual(result, { success: true, data: { domains: ["example.com", "other.org"] } })
  assert.equal(parseDomainSearchRequest({ domains: ["example"] }).success, false)
})
