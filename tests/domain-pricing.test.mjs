import test from "node:test"
import assert from "node:assert/strict"
import { calculateRetailPrice, isPricingSnapshotFresh } from "../src/lib/domains/pricing.ts"

test("calculates ZMW cost, margin, and rounds retail upward to a whole kwacha", () => {
  const result = calculateRetailPrice({
    wholesaleMinor: 1000,
    fxRateMicros: 25_000_000,
    marginBasisPoints: 2000,
  })

  assert.deepEqual(result, { costZmwMinor: 25_000, retailZmwMinor: 30_000 })
})

test("rounds fractional conversion and margin upward rather than reducing margin", () => {
  const result = calculateRetailPrice({
    wholesaleMinor: 101,
    fxRateMicros: 1_500_001,
    marginBasisPoints: 1250,
    roundingIncrementMinor: 1,
  })

  assert.equal(result.costZmwMinor, 152)
  assert.equal(result.retailZmwMinor, 171)
})

test("rejects invalid or unsafe pricing inputs", () => {
  assert.throws(() => calculateRetailPrice({
    wholesaleMinor: -1, fxRateMicros: 1_000_000, marginBasisPoints: 1000,
  }), RangeError)
  assert.throws(() => calculateRetailPrice({
    wholesaleMinor: 100, fxRateMicros: 0, marginBasisPoints: 1000,
  }), RangeError)
  assert.throws(() => calculateRetailPrice({
    wholesaleMinor: Number.MAX_SAFE_INTEGER,
    fxRateMicros: Number.MAX_SAFE_INTEGER,
    marginBasisPoints: 1000,
  }), RangeError)
})

test("a pricing snapshot is fresh only when its timestamp is valid and within the window", () => {
  const now = Date.parse("2026-10-18T10:00:00.000Z")
  assert.equal(isPricingSnapshotFresh("2026-10-18T09:00:00.000Z", now), true)
  assert.equal(isPricingSnapshotFresh("2026-10-17T09:00:00.000Z", now), false)
  assert.equal(isPricingSnapshotFresh(null, now), false)
  assert.equal(isPricingSnapshotFresh("not-a-date", now), false)
  assert.equal(isPricingSnapshotFresh("2026-10-18T11:00:00.000Z", now), false)
})
