import test from "node:test"
import assert from "node:assert/strict"
import {
  buildNameSiloSandboxUrl,
  normalizeNameSiloSandboxDomain,
  normalizeNameSiloSandboxNameservers,
  validateNameSiloYears,
} from "../src/lib/domains/providers/namesilo-sandbox-contract.ts"
import {
  parseNameSiloMutationOutcome,
  parseNameSiloSandboxDomainInfo,
} from "../src/lib/domains/providers/namesilo-operation-response.ts"

test("sandbox URLs always target OTE and encode the API key", () => {
  const url = buildNameSiloSandboxUrl("test key", "getDomainInfo", { domain: "example.com" })
  assert.equal(url.origin, "https://ote.namesilo.com")
  assert.equal(url.pathname, "/api/getDomainInfo")
  assert.equal(url.searchParams.get("key"), "test key")
  assert.equal(url.searchParams.get("domain"), "example.com")
  assert.equal(url.searchParams.get("version"), "1")
  assert.equal(url.searchParams.get("type"), "json")
})

test("sandbox URL builder rejects arbitrary operations and reserved fields", () => {
  assert.throws(() => buildNameSiloSandboxUrl("test", "notAnOperation", {}), /Unsupported/)
  assert.throws(() => buildNameSiloSandboxUrl("test", "getDomainInfo", { key: "override" }), /reserved/)
})

test("sandbox domain validation normalizes case and limits tests to .com/.net", () => {
  assert.equal(normalizeNameSiloSandboxDomain(" Example.COM "), "example.com")
  assert.equal(normalizeNameSiloSandboxDomain("sub.example.net"), "sub.example.net")
  assert.throws(() => normalizeNameSiloSandboxDomain("example.org"), /restricted/)
  assert.throws(() => normalizeNameSiloSandboxDomain("bad..com"), /restricted/)
})

test("sandbox nameservers are limited to two through eight unique NS1-NS8 hosts", () => {
  assert.deepEqual(
    normalizeNameSiloSandboxNameservers(["NS1.NAMESILO.COM", "ns2.namesilo.com"]),
    ["ns1.namesilo.com", "ns2.namesilo.com"],
  )
  assert.throws(() => normalizeNameSiloSandboxNameservers(["ns1.namesilo.com"]), /between 2 and 8/)
  assert.throws(() => normalizeNameSiloSandboxNameservers(["ns1.namesilo.com", "ns1.namesilo.com"]), /unique/)
  assert.throws(() => normalizeNameSiloSandboxNameservers(["ns1.example.com", "ns2.example.com"]), /only ns1/)
})

test("registration and renewal years are integers from one to ten", () => {
  assert.equal(validateNameSiloYears(1), 1)
  assert.equal(validateNameSiloYears(10), 10)
  assert.throws(() => validateNameSiloYears(0), /from 1 to 10/)
  assert.throws(() => validateNameSiloYears(1.5), /from 1 to 10/)
  assert.throws(() => validateNameSiloYears("1"), /from 1 to 10/)
})

test("normal 300 reply acknowledges a mutation but still requires reconciliation", () => {
  const result = parseNameSiloMutationOutcome({
    reply: { code: 300, detail: "success", domain: "example.com", order_amount: "12.95" },
  }, "registerDomain", "example.com")
  assert.equal(result.state, "acknowledged")
  assert.equal(result.providerOrderAmount, "12.95")
  assert.equal(result.reconciliationRequired, true)
})

test("registration response codes 301/302 are successes with warnings, not retries", () => {
  for (const code of [301, 302]) {
    const result = parseNameSiloMutationOutcome({
      reply: { code, detail: "success with fallback", domain: "example.com", order_amount: 12.95 },
    }, "registerDomain", "example.com")
    assert.equal(result.state, "acknowledged_with_warning")
    assert.equal(result.reconciliationRequired, true)
  }
})

test("transfer response code 302 is treated as successful-with-warning", () => {
  const result = parseNameSiloMutationOutcome({
    reply: { code: "302", detail: "success with default contact profile", domain: "example.com" },
  }, "transferDomain", "example.com")
  assert.equal(result.state, "acknowledged_with_warning")
})

test("known NameSilo authentication response is rejected without exposing provider detail", () => {
  const result = parseNameSiloMutationOutcome({
    reply: { code: 280, detail: "API key not valid" },
  }, "registerDomain", "example.com")
  assert.equal(result.state, "rejected")
  assert.equal(result.message.includes("API key not valid"), false)
})

test("network failures, unknown codes, malformed payloads and mismatched domains stay ambiguous", () => {
  const results = [
    parseNameSiloMutationOutcome(null, "registerDomain", "example.com", false),
    parseNameSiloMutationOutcome({ reply: { code: 999, detail: "unknown", domain: "example.com" } }, "renewDomain", "example.com"),
    parseNameSiloMutationOutcome({ reply: { code: 300, domain: "different.com" } }, "registerDomain", "example.com"),
    parseNameSiloMutationOutcome({}, "registerDomain", "example.com"),
  ]
  assert.ok(results.every((result) => result.state === "ambiguous"))
  assert.ok(results.every((result) => result.reconciliationRequired))
})

test("getDomainInfo parser extracts only confirmed, matching domain fields", () => {
  const result = parseNameSiloSandboxDomainInfo({
    reply: {
      code: 300,
      domain: {
        domain: "EXAMPLE.COM",
        status: "Active",
        created: "2026-10-22",
        expires: "2027-10-22",
        locked: "false",
        auto_renew: "0",
        nameservers: { nameserver: [{ "#text": "NS1.NAMESILO.COM" }, { "#text": "NS2.NAMESILO.COM" }] },
      },
    },
  }, "example.com")
  assert.equal(result.state, "found")
  assert.equal(result.providerStatus, "Active")
  assert.equal(result.createdAt, "2026-10-22")
  assert.equal(result.expiresAt, "2027-10-22")
  assert.equal(result.locked, false)
  assert.equal(result.autoRenew, false)
  assert.deepEqual(result.nameservers, ["ns1.namesilo.com", "ns2.namesilo.com"])
})

test("domain info remains unknown on errors or mismatched domains", () => {
  assert.equal(parseNameSiloSandboxDomainInfo({ reply: { code: 300, domain: { domain: "other.net" } } }, "example.com").state, "unknown")
  assert.equal(parseNameSiloSandboxDomainInfo({ reply: { code: 280 } }, "example.com").state, "unknown")
  assert.equal(parseNameSiloSandboxDomainInfo(null, "example.com", false).state, "unknown")
})
