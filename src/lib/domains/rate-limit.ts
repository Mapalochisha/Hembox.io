/**
 * Simple in-memory sliding-window rate limiter.
 *
 * NOTE: This store is in-memory and resets on every server restart.
 * This is intentional for MVP — no external dependencies (e.g. Redis) are
 * required. For a multi-instance production deployment, replace with a shared
 * store such as Upstash Redis or Vercel KV.
 */

const store = new Map<string, number[]>()

export interface RateLimitConfig {
  windowMs: number
  maxRequests: number
}

export interface RateLimitResult {
  allowed: boolean
  retryAfterMs: number
}

/** 20 domain availability searches per minute per IP. */
export const SEARCH_RATE_LIMIT: RateLimitConfig = { windowMs: 60_000, maxRequests: 20 }

/** 10 quote creations per minute per IP. */
export const QUOTE_RATE_LIMIT: RateLimitConfig = { windowMs: 60_000, maxRequests: 10 }

/**
 * Check whether the given IP is within the allowed rate limit.
 * Timestamps are stored per IP; expired entries are cleaned up on each call.
 */
export function checkRateLimit(
  ip: string,
  windowMs: number,
  maxRequests: number,
): RateLimitResult {
  const now = Date.now()
  const windowStart = now - windowMs

  const timestamps = (store.get(ip) ?? []).filter((t) => t > windowStart)

  if (timestamps.length >= maxRequests) {
    // Oldest timestamp in the window determines how long to wait.
    const oldestInWindow = timestamps[0]
    const retryAfterMs = oldestInWindow + windowMs - now
    store.set(ip, timestamps)
    return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 0) }
  }

  timestamps.push(now)
  store.set(ip, timestamps)
  return { allowed: true, retryAfterMs: 0 }
}
