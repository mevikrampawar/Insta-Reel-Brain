// Race a promise against a wall-clock deadline so long-running work
// (AI analysis, scraping) can never leave a job stuck indefinitely.
// The underlying promise is not aborted — it keeps running in the background,
// but callers get a controlled failure after `ms` so the UI can react.
export async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}
