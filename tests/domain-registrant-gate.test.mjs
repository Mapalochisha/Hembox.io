import assert from "node:assert/strict"
import test from "node:test"
import { decideDomainRegistrantGate } from "../src/lib/domains/registrant-gate.ts"

test("only a confirmed registrant record allows a domain payment claim", () => {
  const decision = decideDomainRegistrantGate("ok")
  assert.equal(decision.allow, true)
  assert.equal(decision.code, null)
  assert.equal(decision.status, 200)
})

test("a missing registrant record blocks the claim with actionable guidance", () => {
  const decision = decideDomainRegistrantGate("missing")
  assert.equal(decision.allow, false)
  assert.equal(decision.code, "registrant_details_required")
  assert.equal(decision.status, 409)
  assert.match(decision.message, /Portal/)
})

test("an unavailable registrant check blocks the claim instead of failing open", () => {
  const decision = decideDomainRegistrantGate("unavailable")
  assert.equal(decision.allow, false)
  assert.equal(decision.code, "registrant_details_unavailable")
  assert.equal(decision.status, 503)
  assert.match(decision.message, /No claim was recorded/)
})

test("unexpected gate values deny by default", () => {
  for (const value of ["", "OK", "error", "unknown", null, undefined, 0, {}]) {
    const decision = decideDomainRegistrantGate(value)
    assert.equal(decision.allow, false, `expected ${JSON.stringify(value)} to be denied`)
    assert.equal(decision.status, 503)
  }
})
