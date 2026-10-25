import test from "node:test"
import assert from "node:assert/strict"
import { resolveNameSiloApiConfig } from "../src/lib/domains/providers/namesilo-config.ts"

test("sandbox mode pairs the OTE endpoint only with the sandbox key", () => {
  const config = resolveNameSiloApiConfig("test", {
    NAMESILO_API_KEY: "live-key",
    NAMESILO_SANDBOX_API_KEY: " sandbox-key ",
  })

  assert.equal(config.apiBaseUrl, "https://ote.namesilo.com/api")
  assert.equal(config.apiKey, "sandbox-key")
})

test("live mode pairs the production endpoint only with the live key", () => {
  const config = resolveNameSiloApiConfig("live", {
    NAMESILO_API_KEY: " live-key ",
    NAMESILO_SANDBOX_API_KEY: "sandbox-key",
  })

  assert.equal(config.apiBaseUrl, "https://www.namesilo.com/api")
  assert.equal(config.apiKey, "live-key")
})

test("sandbox mode fails closed when the sandbox key is missing", () => {
  assert.throws(
    () => resolveNameSiloApiConfig("test", { NAMESILO_API_KEY: "live-key" }),
    /NAMESILO_SANDBOX_API_KEY/,
  )
})

test("live mode fails closed when the live key is missing", () => {
  assert.throws(
    () => resolveNameSiloApiConfig("live", { NAMESILO_SANDBOX_API_KEY: "sandbox-key" }),
    /NAMESILO_API_KEY/,
  )
})
