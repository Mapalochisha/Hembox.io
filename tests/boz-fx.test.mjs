import test from "node:test"
import assert from "node:assert/strict"
import { parseBozFxPayload, BOZ_FX_BUFFER_ZMW } from "../src/lib/domains/boz-fx.ts"

const payload = {
  bank: "boz",
  rate_date: "2026-11-02",
  rates: [
    { base: "USD", quote: "ZMW", type: "buy", value: 20.1 },
    { base: "USD", quote: "ZMW", type: "middle", value: 20.15, derived: false },
    { base: "USD", quote: "ZMW", type: "sell", value: 20.2 },
  ],
}

test("accepts only the directly published BoZ USD/ZMW middle rate", () => {
  const result = parseBozFxPayload(payload, "2026-11-02T14:00:00.000Z")
  assert.equal(result.midRate, 20.15)
  assert.equal(result.rateDate, "2026-11-02")
  assert.equal(BOZ_FX_BUFFER_ZMW, 1)
})

test("rejects non-BoZ, derived, missing, malformed, future and stale observations", () => {
  assert.throws(() => parseBozFxPayload({ ...payload, bank: "other" }), /Bank of Zambia/)
  assert.throws(() => parseBozFxPayload({ ...payload, rates: [{ ...payload.rates[1], derived: true }] }), /Derived/)
  assert.throws(() => parseBozFxPayload({ ...payload, rate_date: "not-a-date" }), /publication date/)
  assert.throws(() => parseBozFxPayload({ ...payload, rates: [] }), /middle rate/)
  assert.throws(() => parseBozFxPayload({ ...payload, rate_date: "2026-10-20" }, "2026-11-02T14:00:00.000Z"), /five days/)
})
