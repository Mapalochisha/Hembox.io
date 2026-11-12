/**
 * Unit tests for the in-memory sliding-window rate limiter.
 *
 * Date.now is monkey-patched to control time without real waits.
 */

import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"

// ---- time control --------------------------------------------------------
let fakeNow = Date.now()
const originalDateNow = Date.now.bind(Date)

function setFakeNow(ms) {
  fakeNow = ms
  Date.now = () => fakeNow
}

function advanceTime(ms) {
  fakeNow += ms
}

// ---- import AFTER patching Date.now so the module picks up the stub ------
// We import the module here; because ESM caches it, the same store persists
// across all tests in this file. Each describe block uses a unique IP prefix
// to keep test state isolated.

const { checkRateLimit, SEARCH_RATE_LIMIT, QUOTE_RATE_LIMIT } = await import(
  "../src/lib/domains/rate-limit.ts"
)

// --------------------------------------------------------------------------

describe("rate-limit constants", () => {
  it("SEARCH_RATE_LIMIT has 20 requests per 60 s", () => {
    assert.equal(SEARCH_RATE_LIMIT.windowMs, 60_000)
    assert.equal(SEARCH_RATE_LIMIT.maxRequests, 20)
  })

  it("QUOTE_RATE_LIMIT has 10 requests per 60 s", () => {
    assert.equal(QUOTE_RATE_LIMIT.windowMs, 60_000)
    assert.equal(QUOTE_RATE_LIMIT.maxRequests, 10)
  })
})

describe("checkRateLimit — requests within limit are allowed", () => {
  before(() => setFakeNow(1_000_000))

  it("allows the first N requests", () => {
    const ip = "test-allow-1.2.3.4"
    const { windowMs, maxRequests } = SEARCH_RATE_LIMIT
    for (let i = 0; i < maxRequests; i++) {
      const result = checkRateLimit(ip, windowMs, maxRequests)
      assert.equal(result.allowed, true, `request ${i + 1} should be allowed`)
      assert.equal(result.retryAfterMs, 0)
    }
  })
})

describe("checkRateLimit — requests over limit are rejected", () => {
  before(() => setFakeNow(2_000_000))

  it("rejects the (N+1)th request and returns a positive retryAfterMs", () => {
    const ip = "test-reject-5.6.7.8"
    const { windowMs, maxRequests } = SEARCH_RATE_LIMIT
    for (let i = 0; i < maxRequests; i++) {
      checkRateLimit(ip, windowMs, maxRequests)
    }
    const result = checkRateLimit(ip, windowMs, maxRequests)
    assert.equal(result.allowed, false)
    assert.ok(result.retryAfterMs > 0, `retryAfterMs should be > 0, got ${result.retryAfterMs}`)
  })

  it("retryAfterMs is at most windowMs", () => {
    const ip = "test-retry-9.9.9.9"
    const { windowMs, maxRequests } = SEARCH_RATE_LIMIT
    for (let i = 0; i < maxRequests; i++) {
      checkRateLimit(ip, windowMs, maxRequests)
    }
    const result = checkRateLimit(ip, windowMs, maxRequests)
    assert.ok(result.retryAfterMs <= windowMs)
  })
})

describe("checkRateLimit — window resets after expiry", () => {
  before(() => setFakeNow(3_000_000))
  after(() => { Date.now = originalDateNow })

  it("allows requests again after the window has elapsed", () => {
    const ip = "test-reset-10.0.0.1"
    const { windowMs, maxRequests } = SEARCH_RATE_LIMIT

    // Fill the window.
    for (let i = 0; i < maxRequests; i++) {
      checkRateLimit(ip, windowMs, maxRequests)
    }

    // Confirm we are blocked.
    const blocked = checkRateLimit(ip, windowMs, maxRequests)
    assert.equal(blocked.allowed, false)

    // Advance time past the window.
    advanceTime(windowMs + 1)

    // Now we should be allowed again.
    const result = checkRateLimit(ip, windowMs, maxRequests)
    assert.equal(result.allowed, true, "should be allowed after window expiry")
    assert.equal(result.retryAfterMs, 0)
  })

  it("QUOTE_RATE_LIMIT rejects after 10 and resets after window", () => {
    const ip = "test-quote-20.0.0.1"
    const { windowMs, maxRequests } = QUOTE_RATE_LIMIT

    for (let i = 0; i < maxRequests; i++) {
      const r = checkRateLimit(ip, windowMs, maxRequests)
      assert.equal(r.allowed, true)
    }

    const blocked = checkRateLimit(ip, windowMs, maxRequests)
    assert.equal(blocked.allowed, false)

    advanceTime(windowMs + 1)

    const reset = checkRateLimit(ip, windowMs, maxRequests)
    assert.equal(reset.allowed, true)
  })
})
