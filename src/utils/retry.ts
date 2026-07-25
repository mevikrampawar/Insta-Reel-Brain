// Exponential backoff retry for API calls.

interface RetryOptions {
  maxRetries?: number
  baseDelayMs?: number
  maxDelayMs?: number
  onRetry?: (attempt: number, error: Error) => void
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { maxRetries = 2, baseDelayMs = 1000, maxDelayMs = 10000, onRetry } = options

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt === maxRetries) throw error

      const err = error instanceof Error ? error : new Error(String(error))
      const isRetryable = isRetryableError(err)

      if (!isRetryable) throw error

      const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs)
      const jitter = delay * 0.2 * Math.random()
      onRetry?.(attempt + 1, err)
      await new Promise(r => setTimeout(r, delay + jitter))
    }
  }

  throw new Error('unreachable')
}

function isRetryableError(error: Error): boolean {
  const msg = error.message.toLowerCase()
  return (
    msg.includes('rate limit') ||
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('502') ||
    msg.includes('timeout') ||
    msg.includes('network') ||
    msg.includes('econnreset') ||
    msg.includes('econnrefused')
  )
}
