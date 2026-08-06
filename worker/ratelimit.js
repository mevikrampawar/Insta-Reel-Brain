// Fixed-window rate limiter. Uses a KV namespace when bound; otherwise
// degrades to an in-memory per-isolate counter (fine for a personal worker).

const memStore = new Map()

export async function rateLimit(env, key, limit, windowMs) {
  const now = Date.now()
  const windowStart = Math.floor(now / windowMs) * windowMs
  const cacheKey = `rl:${key}:${windowStart}`

  if (env && env.RATE_LIMIT_KV) {
    const stored = await env.RATE_LIMIT_KV.get(cacheKey)
    const count = stored ? Number(stored) : 0
    if (count >= limit) {
      return { limited: true, retryAfterMs: windowMs - (now - windowStart) }
    }
    await env.RATE_LIMIT_KV.put(cacheKey, String(count + 1), { expirationTtl: Math.ceil(windowMs / 1000) })
    return { limited: false, remaining: limit - count - 1 }
  }

  const prev = memStore.get(cacheKey) || 0
  if (prev >= limit) {
    return { limited: true, retryAfterMs: windowMs - (now - windowStart) }
  }
  memStore.set(cacheKey, prev + 1)
  setTimeout(() => memStore.delete(cacheKey), windowMs + 1000)
  return { limited: false, remaining: limit - prev - 1 }
}
