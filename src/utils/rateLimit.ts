// Token bucket rate limiter for API calls.
// Ensures we stay within free tier limits.

interface Bucket {
  tokens: number
  lastRefill: number
}

const buckets = new Map<string, Bucket>()

export function rateLimit(
  key: string,
  maxPerMinute: number,
  minIntervalMs = 2000,
): { allowed: boolean; waitMs: number } {
  const now = Date.now()
  let bucket = buckets.get(key)

  if (!bucket) {
    bucket = { tokens: maxPerMinute, lastRefill: now }
    buckets.set(key, bucket)
  }

  // Refill tokens based on time elapsed
  const elapsed = now - bucket.lastRefill
  const refillRate = maxPerMinute / 60000 // tokens per ms
  const refillAmount = elapsed * refillRate
  bucket.tokens = Math.min(maxPerMinute, bucket.tokens + refillAmount)
  bucket.lastRefill = now

  // Check minimum interval since last call
  const lastCall = bucket.lastRefill
  if (now - lastCall < minIntervalMs) {
    return { allowed: false, waitMs: minIntervalMs - (now - lastCall) }
  }

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1
    return { allowed: true, waitMs: 0 }
  }

  // Calculate wait time for next token
  const waitMs = Math.ceil((1 - bucket.tokens) / refillRate)
  return { allowed: false, waitMs }
}
