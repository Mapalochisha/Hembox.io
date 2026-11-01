import test from "node:test"
import assert from "node:assert/strict"
import { parseNameSiloStandardPrices, getNameSiloStandardPrices, resolveNameSiloPriceEnvironment } from "../src/lib/domains/providers/namesilo-prices.ts"

const fixture = { reply: { code: 300, detail: "success", com: { registration: "17.29", transfer: "10.40", renew: "17.29" }, net: { registration: 15.95, transfer: 11.35, renew: 15.95 } } }

test("parses standard NameSilo registration and renewal prices into integer USD cents", () => {
  assert.deepEqual(parseNameSiloStandardPrices(fixture), [
    { tld: "com", registrationUsdMinor: 1729, renewalUsdMinor: 1729 },
    { tld: "net", registrationUsdMinor: 1595, renewalUsdMinor: 1595 },
  ])
})

test("rejects non-success, incomplete, malformed, zero and empty price responses", () => {
  assert.throws(() => parseNameSiloStandardPrices({ reply: { code: 110 } }), /did not confirm/)
  assert.throws(() => parseNameSiloStandardPrices({ reply: { code: 300, com: { registration: "10.00" } } }), /incomplete/)
  assert.throws(() => parseNameSiloStandardPrices({ reply: { code: 300, com: { registration: "10.999", renew: "10.00" } } }), /invalid/)
  assert.throws(() => parseNameSiloStandardPrices({ reply: { code: 300, com: { registration: "0", renew: "10.00" } } }), /unsafe/)
  assert.throws(() => parseNameSiloStandardPrices({ reply: { code: 300, detail: "success" } }), /no usable/)
})

test("requests the explicit standard retail price list from the live API host", async () => {
  let requestedUrl = ""
  const result = await getNameSiloStandardPrices({
    env: { DOMAIN_PROVIDER_MODE: "namesilo", NAMESILO_API_KEY: "test-secret" },
    fetchImpl: async (input) => { requestedUrl = String(input); return new Response(JSON.stringify(fixture), { status: 200, headers: { "Content-Type": "application/json" } }) },
  })
  const url = new URL(requestedUrl)
  assert.equal(url.origin, "https://www.namesilo.com")
  assert.equal(url.pathname, "/api/getPrices")
  assert.equal(url.searchParams.get("retail_prices"), "1")
  assert.equal(url.searchParams.get("key"), "test-secret")
  assert.equal(result.source, "namesilo-standard-retail")
  assert.equal(result.prices.length, 2)
})
test("follows the configured provider mode instead of always forcing production", () => {
  assert.equal(resolveNameSiloPriceEnvironment({ DOMAIN_PROVIDER_MODE: "namesilo-sandbox" }), "test")
  assert.equal(resolveNameSiloPriceEnvironment({ DOMAIN_PROVIDER_MODE: "namesilo" }), "live")
  assert.throws(() => resolveNameSiloPriceEnvironment({}), /not the configured domain provider/)
  assert.throws(() => resolveNameSiloPriceEnvironment({ DOMAIN_PROVIDER_MODE: "mock" }), /not the configured domain provider/)
  assert.throws(() => resolveNameSiloPriceEnvironment({ DOMAIN_PROVIDER_MODE: "namesilo-typo" }), /not the configured domain provider/)
})

test("sandbox mode uses the OTE host and the sandbox key only", async () => {
  let requestedUrl = ""
  const result = await getNameSiloStandardPrices({
    env: { DOMAIN_PROVIDER_MODE: "namesilo-sandbox", NAMESILO_SANDBOX_API_KEY: "sandbox-secret", NAMESILO_API_KEY: "live-secret" },
    fetchImpl: async (input) => { requestedUrl = String(input); return new Response(JSON.stringify(fixture), { status: 200, headers: { "Content-Type": "application/json" } }) },
  })
  const url = new URL(requestedUrl)
  assert.equal(url.origin, "https://ote.namesilo.com")
  assert.equal(url.searchParams.get("key"), "sandbox-secret")
  assert.equal(result.environment, "test")
})

test("live mode uses the production host and the live key only", async () => {
  let requestedUrl = ""
  const result = await getNameSiloStandardPrices({
    env: { DOMAIN_PROVIDER_MODE: "namesilo", NAMESILO_SANDBOX_API_KEY: "sandbox-secret", NAMESILO_API_KEY: "live-secret" },
    fetchImpl: async (input) => { requestedUrl = String(input); return new Response(JSON.stringify(fixture), { status: 200, headers: { "Content-Type": "application/json" } }) },
  })
  const url = new URL(requestedUrl)
  assert.equal(url.origin, "https://www.namesilo.com")
  assert.equal(url.searchParams.get("key"), "live-secret")
  assert.equal(result.environment, "live")
})

test("refuses to retrieve prices when no provider mode is configured", async () => {
  await assert.rejects(() => getNameSiloStandardPrices({ env: {}, fetchImpl: async () => new Response("{}") }), /not the configured domain provider/)
})
