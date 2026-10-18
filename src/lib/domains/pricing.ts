/**
 * Provider-independent domain pricing policy.
 *
 * All monetary values are integer minor units. fxRateMicros represents the
 * number of ZMW minor units per wholesale-currency minor unit, scaled by 1e6.
 * For example, an FX ratio of 25.0 is represented as 25_000_000.
 * Prices are rounded UP to the configured minor-unit increment so rounding
 * never silently reduces the configured margin.
 */

export const FX_RATE_SCALE = BigInt(1_000_000)
export const BASIS_POINTS = BigInt(10_000)
export const DEFAULT_PRICE_ROUNDING_MINOR = 100

export type DomainPricingInput = {
  wholesaleMinor: number
  fxRateMicros: number
  marginBasisPoints: number
  roundingIncrementMinor?: number
}

function requireSafeInteger(name: string, value: number, minimum: number) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new RangeError(`${name} must be a safe integer greater than or equal to ${minimum}.`)
  }
}

function ceilDivide(numerator: bigint, denominator: bigint) {
  return (numerator + denominator - BigInt(1)) / denominator
}

export function calculateRetailPrice(input: DomainPricingInput): {
  costZmwMinor: number
  retailZmwMinor: number
} {
  requireSafeInteger("wholesaleMinor", input.wholesaleMinor, 0)
  requireSafeInteger("fxRateMicros", input.fxRateMicros, 1)
  requireSafeInteger("marginBasisPoints", input.marginBasisPoints, 0)

  const rounding = input.roundingIncrementMinor ?? DEFAULT_PRICE_ROUNDING_MINOR
  requireSafeInteger("roundingIncrementMinor", rounding, 1)

  const cost = ceilDivide(
    BigInt(input.wholesaleMinor) * BigInt(input.fxRateMicros),
    FX_RATE_SCALE,
  )
  const withMargin = ceilDivide(
    cost * (BASIS_POINTS + BigInt(input.marginBasisPoints)),
    BASIS_POINTS,
  )
  const roundedRetail = ceilDivide(withMargin, BigInt(rounding)) * BigInt(rounding)

  if (cost > BigInt(Number.MAX_SAFE_INTEGER) || roundedRetail > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError("Calculated price exceeds the safe integer range.")
  }

  return {
    costZmwMinor: Number(cost),
    retailZmwMinor: Number(roundedRetail),
  }
}

/**
 * A catalogue entry is eligible for a current public price only while its
 * manually verified cost/FX snapshot is fresh. This does not imply availability.
 */
export function isPricingSnapshotFresh(
  priceUpdatedAt: string | null | undefined,
  now = Date.now(),
  maxAgeMs = 24 * 60 * 60 * 1000,
): boolean {
  if (!priceUpdatedAt || !Number.isFinite(now) || !Number.isFinite(maxAgeMs) || maxAgeMs < 0) {
    return false
  }

  const timestamp = Date.parse(priceUpdatedAt)
  if (!Number.isFinite(timestamp) || timestamp > now) return false
  return now - timestamp <= maxAgeMs
}
