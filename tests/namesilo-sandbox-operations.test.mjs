import test from "node:test"
import assert from "node:assert/strict"
import { createNameSiloSandboxOperations } from "../src/lib/domains/providers/namesilo-sandbox-operations.ts"

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  }
}

function env() {
  return {
    DOMAIN_PROVIDER_MODE: "namesilo-sandbox",
    NAMESILO_SANDBOX_API_KEY: "dummy-sandbox-key",
    NAMESILO_API_KEY: "dummy-live-key",
  }
}

test("domain-info request uses the OTE host and only the sandbox key", async () => {
  let requestedUrl
  const api = createNameSiloSandboxOperations({
    env: env(),
    fetchImpl: async (url) => {
      requestedUrl = new URL(String(url))
      return response({ reply: { code: 300, domain: { domain: "example.com", status: "Active" } } })
    },
  })

  const info = await api.getDomainInfo("example.com")
  assert.equal(requestedUrl.origin, "https://ote.namesilo.com")
  assert.equal(requestedUrl.pathname, "/api/getDomainInfo")
  assert.equal(requestedUrl.searchParams.get("key"), "dummy-sandbox-key")
  assert.notEqual(requestedUrl.searchParams.get("key"), "dummy-live-key")
  assert.equal(info.state, "found")
})

test("registration preflights availability and blocks unavailable OTE domains", async () => {
  const operations = []
  const api = createNameSiloSandboxOperations({
    env: env(),
    fetchImpl: async (url) => {
      const parsed = new URL(String(url))
      operations.push(parsed.pathname)
      if (parsed.pathname.endsWith("/checkRegisterAvailability")) {
        return response({ reply: { code: 300, unavailable: { domain: "example.com" } } })
      }
      throw new Error("registerDomain must not be called for an unavailable domain")
    },
  })

  const outcome = await api.registerDomain({
    confirmSandboxOnly: "OTE_ONLY",
    domain: "example.com",
    years: 1,
  })
  assert.equal(outcome.state, "not_attempted")
  assert.deepEqual(operations, ["/api/checkRegisterAvailability"])
})

test("registration uses explicit sandbox confirmation and sends conservative defaults", async () => {
  const operations = []
  const api = createNameSiloSandboxOperations({
    env: env(),
    fetchImpl: async (url) => {
      const parsed = new URL(String(url))
      operations.push(parsed)
      if (parsed.pathname.endsWith("/checkRegisterAvailability")) {
        return response({ reply: { code: 300, available: { domain: "hembox-ote-test.com" } } })
      }
      if (parsed.pathname.endsWith("/registerDomain")) {
        return response({ reply: { code: 300, detail: "success", domain: "hembox-ote-test.com", order_amount: "10.00" } })
      }
      throw new Error("Unexpected NameSilo operation")
    },
  })

  const outcome = await api.registerDomain({
    confirmSandboxOnly: "OTE_ONLY",
    domain: "Hembox-OTE-Test.com",
    years: 1,
  })

  assert.equal(outcome.state, "acknowledged")
  const registerUrl = operations[1]
  assert.equal(registerUrl.origin, "https://ote.namesilo.com")
  assert.equal(registerUrl.searchParams.get("domain"), "hembox-ote-test.com")
  assert.equal(registerUrl.searchParams.get("years"), "1")
  assert.equal(registerUrl.searchParams.get("private"), "0")
  assert.equal(registerUrl.searchParams.get("auto_renew"), "0")
  assert.equal(registerUrl.searchParams.get("key"), "dummy-sandbox-key")
  assert.equal(registerUrl.searchParams.has("payment_id"), false)
})

test("state-changing sandbox methods refuse calls without the explicit OTE confirmation token", async () => {
  let callCount = 0
  const api = createNameSiloSandboxOperations({
    env: env(),
    fetchImpl: async () => { callCount++; return response({ reply: { code: 300 } }) },
  })

  await assert.rejects(
    api.registerDomain({ domain: "example.com", years: 1 }),
    /confirmSandboxOnly/,
  )
  assert.equal(callCount, 0)
})

test("mutation network failures stay ambiguous and never log or retry", async () => {
  let callCount = 0
  const api = createNameSiloSandboxOperations({
    env: env(),
    fetchImpl: async (url) => {
      callCount++
      const parsed = new URL(String(url))
      if (parsed.pathname.endsWith("/checkRegisterAvailability")) {
        return response({ reply: { code: 300, available: { domain: "hembox-ote-test.com" } } })
      }
      throw new Error("simulated lost response")
    },
  })

  const result = await api.registerDomain({
    confirmSandboxOnly: "OTE_ONLY",
    domain: "hembox-ote-test.com",
    years: 1,
  })
  assert.equal(result.state, "ambiguous")
  assert.equal(result.reconciliationRequired, true)
  assert.equal(callCount, 2)
})
