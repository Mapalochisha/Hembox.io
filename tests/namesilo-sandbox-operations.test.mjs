import test from "node:test"
import assert from "node:assert/strict"
import { createNameSiloSandboxOperations } from "../src/lib/domains/providers/namesilo-sandbox-operations.ts"

function response(payload, status = 200, headers = {}) {
  const text = typeof payload === "string"
    ? payload
    : payload === null || payload === undefined
      ? ""
      : JSON.stringify(payload)
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name) => headers[String(name).toLowerCase()] ?? null,
    },
    json: async () => {
      if (typeof payload === "string") throw new SyntaxError("response is not JSON")
      return payload
    },
    text: async () => text,
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

test("getDomainInfo may omit the queried domain in its documented successful reply", async () => {
  const api = createNameSiloSandboxOperations({
    env: env(),
    fetchImpl: async (url) => {
      const parsed = new URL(String(url))
      assert.equal(parsed.pathname, "/api/getDomainInfo")
      return response({ reply: { code: 300, detail: "success", status: "Active", created: "2026-10-22", expires: "2027-10-22" } })
    },
  })

  const info = await api.getDomainInfo("example.com")
  assert.equal(info.state, "found")
  assert.equal(info.domain, "example.com")
  assert.equal(info.providerCode, 300)
  assert.equal(info.providerStatus, "Active")
})

test("renewal will not call the transactional endpoint for an expired domain", async () => {
  const operations = []
  const api = createNameSiloSandboxOperations({
    env: env(),
    fetchImpl: async (url) => {
      const parsed = new URL(String(url))
      operations.push(parsed.pathname)
      return response({ reply: { code: 300, detail: "success", status: "Expired", created: "2024-10-22", expires: "2025-10-22" } })
    },
  })

  const outcome = await api.renewDomain({
    confirmSandboxOnly: "OTE_ONLY",
    domain: "example.com",
    years: 1,
  })
  assert.equal(outcome.state, "not_attempted")
  assert.deepEqual(operations, ["/api/getDomainInfo"])
})


test("batch availability recognizes array-based NameSilo OTE responses", async () => {
  const api = createNameSiloSandboxOperations({
    env: env(),
    fetchImpl: async () => response({
      reply: {
        code: 300,
        detail: "success",
        available: [{ domain: "example.com", price: "9.99" }],
        unavailable: ["example.net"],
      },
    }),
  })

  const results = await api.checkAvailability(["example.com", "example.net"])
  assert.equal(results[0].availability, "available")
  assert.equal(results[0].providerCode, 300)
  assert.match(results[0].message, /not a live-registry guarantee/)
  assert.equal(results[1].availability, "unavailable")
})

test("batch availability reports a diagnostic when code 300 has no recognized domain bucket", async () => {
  const api = createNameSiloSandboxOperations({
    env: env(),
    fetchImpl: async () => response({ reply: { code: 300, detail: "success" } }),
  })

  const results = await api.checkAvailability(["example.com"])
  assert.equal(results[0].availability, "unknown")
  assert.equal(results[0].providerCode, 300)
  assert.match(results[0].message, /no recognized availability entry/)
})

test("domain-info keeps code 114 unclassified but preserves its provider detail", async () => {
  const api = createNameSiloSandboxOperations({
    env: env(),
    fetchImpl: async () => response({
      reply: { code: 114, detail: "Sample domain is not present in this test account" },
    }),
  })

  const info = await api.getDomainInfo("example.com")
  assert.equal(info.state, "unknown")
  assert.equal(info.providerCode, 114)
  assert.match(info.message, /response code 114/)
  assert.match(info.message, /not present in this test account/)
})


test("domain-info reports HTTP status for non-successful OTE responses without exposing credentials", async () => {
  const api = createNameSiloSandboxOperations({
    env: env(),
    fetchImpl: async () => response(null, 403),
  })

  const info = await api.getDomainInfo("namesilo.com")
  assert.equal(info.state, "unknown")
  assert.equal(info.providerCode, null)
  assert.match(info.message, /HTTP 403/)
  assert.doesNotMatch(info.message, /dummy-sandbox-key/)
})

test("domain-info distinguishes OTE timeouts from network failures", async () => {
  const timedOut = createNameSiloSandboxOperations({
    env: env(),
    fetchImpl: async () => {
      const error = new Error("simulated timeout")
      error.name = "TimeoutError"
      throw error
    },
  })
  const networkFailed = createNameSiloSandboxOperations({
    env: env(),
    fetchImpl: async () => { throw new TypeError("simulated network failure") },
  })

  const timeoutInfo = await timedOut.getDomainInfo("namesilo.com")
  const networkInfo = await networkFailed.getDomainInfo("namesilo.com")
  assert.match(timeoutInfo.message, /timed out/)
  assert.match(networkInfo.message, /network layer/)
})

test("domain-info identifies invalid JSON while keeping response details private", async () => {
  const api = createNameSiloSandboxOperations({
    env: env(),
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError("private response contents") },
    }),
  })

  const info = await api.getDomainInfo("namesilo.com")
  assert.equal(info.state, "unknown")
  assert.match(info.message, /invalid JSON/)
  assert.doesNotMatch(info.message, /private response contents/)
})

test("domain-info explains an HTTP 400 that carries a structured JSON provider reply", async () => {
  const api = createNameSiloSandboxOperations({
    env: env(),
    fetchImpl: async () => response(
      { request: { operation: "getDomainInfo" }, reply: { code: 114, detail: "Invalid Domain Syntax" } },
      400,
      { "content-type": "application/json" },
    ),
  })

  const info = await api.getDomainInfo("namesilo.com")
  assert.equal(info.state, "unknown")
  assert.match(info.message, /HTTP 400/)
  assert.match(info.message, /Provider code 114/)
  assert.match(info.message, /Invalid Domain Syntax/)
  assert.doesNotMatch(info.message, /dummy-sandbox-key/)
})

test("domain-info explains an HTTP error returned as XML", async () => {
  const api = createNameSiloSandboxOperations({
    env: env(),
    fetchImpl: async () => response(
      "<namesilo><reply><code>114</code><detail>Invalid Domain Syntax</detail></reply></namesilo>",
      400,
      { "content-type": "application/xml" },
    ),
  })

  const info = await api.getDomainInfo("namesilo.com")
  assert.match(info.message, /HTTP 400/)
  assert.match(info.message, /Provider code 114/)
  assert.match(info.message, /Invalid Domain Syntax/)
})

test("domain-info does not treat an HTML error page as a provider reply", async () => {
  const api = createNameSiloSandboxOperations({
    env: env(),
    fetchImpl: async () => response(
      "<html><body><code>500</code>Request blocked</body></html>",
      400,
      { "content-type": "text/html; charset=utf-8", server: "cloudflare" },
    ),
  })

  const info = await api.getDomainInfo("namesilo.com")
  assert.match(info.message, /HTTP 400/)
  assert.match(info.message, /no structured provider reply/i)
  assert.match(info.message, /text\/html/)
  assert.match(info.message, /cloudflare/)
  assert.doesNotMatch(info.message, /Provider code 500/)
  assert.doesNotMatch(info.message, /Request blocked/)
})

test("account balance parses a numeric string without referencing a domain", async () => {
  let requestedUrl
  const api = createNameSiloSandboxOperations({
    env: env(),
    fetchImpl: async (url) => {
      requestedUrl = new URL(String(url))
      return response({ reply: { code: 300, detail: "success", balance: "355.75" } })
    },
  })

  const balance = await api.getAccountBalance()
  assert.equal(requestedUrl.origin, "https://ote.namesilo.com")
  assert.equal(requestedUrl.pathname, "/api/getAccountBalance")
  assert.equal(requestedUrl.searchParams.get("key"), "dummy-sandbox-key")
  assert.equal(requestedUrl.searchParams.has("domain"), false)
  assert.equal(balance.providerCode, 300)
  assert.equal(balance.balance, "355.75")
})

test("account balance reports provider rejection without inventing a balance", async () => {
  const api = createNameSiloSandboxOperations({
    env: env(),
    fetchImpl: async () => response({ reply: { code: 110, detail: "Invalid API key" } }),
  })

  const balance = await api.getAccountBalance()
  assert.equal(balance.providerCode, 110)
  assert.equal(balance.balance, null)
  assert.match(balance.message, /rejected the API key/i)
  assert.match(balance.message, /Invalid API key/)
})

test("domain list accepts JSON arrays and XML-to-JSON domain containers", async () => {
  const jsonList = createNameSiloSandboxOperations({
    env: env(),
    fetchImpl: async () => response({
      reply: { code: 300, detail: "success", domains: [{ domain: "A.com" }, { domain: "b.net" }] },
    }),
  })
  const xmlList = createNameSiloSandboxOperations({
    env: env(),
    fetchImpl: async () => response({
      reply: { code: 300, detail: "success", domains: { domain: [{ $t: "a.com" }, { "#text": "b.net" }] } },
    }),
  })

  const jsonResult = await jsonList.listDomains()
  const xmlResult = await xmlList.listDomains()
  assert.deepEqual(jsonResult.domains, ["a.com", "b.net"])
  assert.deepEqual(xmlResult.domains, ["a.com", "b.net"])
  assert.equal(jsonResult.providerCode, 300)
})

test("domain list distinguishes an empty sandbox account from a listing failure", async () => {
  const empty = createNameSiloSandboxOperations({
    env: env(),
    fetchImpl: async () => response({ reply: { code: 300, detail: "success" } }),
  })
  const failed = createNameSiloSandboxOperations({
    env: env(),
    fetchImpl: async () => response({ reply: { code: 210, detail: "General error" } }),
  })

  const emptyResult = await empty.listDomains()
  const failedResult = await failed.listDomains()
  assert.deepEqual(emptyResult.domains, [])
  assert.match(emptyResult.message, /no active domains/i)
  assert.equal(failedResult.providerCode, 210)
  assert.match(failedResult.message, /response code 210/)
})

test("account balance exposes only reply field names and balance value type when missing", async () => {
  const api = createNameSiloSandboxOperations({
    env: env(),
    fetchImpl: async () => response({
      reply: { code: 300, detail: "success", accountFunds: "private-value" },
    }),
  })

  const balance = await api.getAccountBalance()
  assert.equal(balance.providerCode, 300)
  assert.equal(balance.balance, null)
  assert.deepEqual(balance.responseShape, {
    replyFields: ["code", "detail", "accountFunds"],
    balanceFieldType: "missing",
  })
  assert.doesNotMatch(JSON.stringify(balance), /private-value/)
})

test("account balance classifies an unexpected string without exposing its contents", async () => {
  const secretLikeValue = "sandbox balance is not set"
  const api = createNameSiloSandboxOperations({
    env: env(),
    fetchImpl: async () => response({
      reply: { code: 300, detail: "success", balance: secretLikeValue },
    }),
  })

  const balance = await api.getAccountBalance()
  assert.equal(balance.providerCode, 300)
  assert.equal(balance.balance, null)
  assert.equal(balance.responseShape?.balanceStringFormat, "non-numeric")
  assert.doesNotMatch(JSON.stringify(balance), /sandbox balance is not set/)
})

