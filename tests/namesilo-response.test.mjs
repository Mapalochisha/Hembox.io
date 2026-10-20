import test from "node:test"
import assert from "node:assert/strict"
import { parseNameSiloAvailability } from "../src/lib/domains/providers/namesilo-response.ts"

test("maps explicit NameSilo available and unavailable lists", () => {
  const payload = {
    reply: {
      code: 300,
      detail: "success",
      available: { domain: [{ "#text": "available.example", "@attributes": { price: "12.00" } }] },
      unavailable: { domain: "taken.example" },
    },
  }

  const result = parseNameSiloAvailability(payload, ["available.example", "taken.example"])
  assert.equal(result.get("available.example"), "available")
  assert.equal(result.get("taken.example"), "unavailable")
})

test("accepts a domain-list array and normalizes case", () => {
  const result = parseNameSiloAvailability({
    reply: {
      code: "300",
      available: { domain: ["EXAMPLE.COM", "other.net"] },
    },
  }, ["example.com", "other.net"])

  assert.equal(result.get("example.com"), "available")
  assert.equal(result.get("other.net"), "available")
})

test("does not infer availability from a successful but empty reply", () => {
  const result = parseNameSiloAvailability({ reply: { code: 300, detail: "success" } }, ["example.com"])
  assert.equal(result.get("example.com"), "unknown")
})

test("does not trust failed provider response codes", () => {
  const result = parseNameSiloAvailability({
    reply: { code: 280, detail: "API key not valid", available: { domain: "example.com" } },
  }, ["example.com"])
  assert.equal(result.get("example.com"), "unknown")
})

test("ignores domains that were not requested", () => {
  const result = parseNameSiloAvailability({
    reply: { code: 300, available: { domain: ["other.com"] } },
  }, ["example.com"])
  assert.equal(result.get("example.com"), "unknown")
  assert.equal(result.has("other.com"), false)
})

test("invalid domains remain unknown rather than available or unavailable", () => {
  const result = parseNameSiloAvailability({
    reply: {
      code: 300,
      available: { domain: "example.com" },
      invalid: { domain: "bad..example" },
    },
  }, ["example.com", "bad..example"])
  assert.equal(result.get("example.com"), "available")
  assert.equal(result.get("bad..example"), "unknown")
})

test("malformed payloads leave all requested domains unknown", () => {
  for (const payload of [null, {}, { reply: null }, { reply: { code: 300, available: "example.com" } }]) {
    const result = parseNameSiloAvailability(payload, ["example.com"])
    assert.equal(result.get("example.com"), "unknown")
  }
})
