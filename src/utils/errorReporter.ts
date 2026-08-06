const STORAGE_KEY = 'reelbrain-error-log'
const MAX_ENTRIES = 20

export interface ErrorEntry {
  ts: number
  type: string
  message: string
  source?: string
  lineno?: number
  colno?: number
  stack?: string
  url?: string
}

function load(): ErrorEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persist(entries: ErrorEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)))
  } catch {
    // Storage may be full — drop the oldest entry and retry once
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES + 1)))
    } catch { /* ignore */ }
  }
}

export function getErrorLog(): ErrorEntry[] {
  return load()
}

export function clearErrorLog() {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
}

export function recordError(entry: Omit<ErrorEntry, 'ts'>) {
  persist([...load(), { ...entry, ts: Date.now() }])
}

export function installErrorReporter() {
  if (typeof window === 'undefined') return

  window.addEventListener('error', (event) => {
    recordError({
      type: 'error',
      message: event.message || 'Unknown script error',
      source: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      url: window.location.href,
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    recordError({
      type: 'unhandledrejection',
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      url: window.location.href,
    })
  })
}
