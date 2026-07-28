import { useState, useCallback, useRef } from 'react'

export interface BatchJob {
  id: string
  status: 'pending' | 'processing' | 'done' | 'failed' | 'cancelled'
  error?: string
}

export interface BatchProgress {
  total: number
  done: number
  failed: number
  current: string | null
  jobs: BatchJob[]
  isRunning: boolean
  isPaused: boolean
}

// Rate limits: Groq free = 28 req/min, each reel = ~4 calls → ~7 reels/min
// Add safety margin → 1 reel per 10 seconds
const ANALYSIS_DELAY_MS = 10_000
// Apify: serialize, one scrape at a time
const SCRAPE_DELAY_MS = 5_000

export function useBatchProcess() {
  const [progress, setProgress] = useState<BatchProgress>({
    total: 0, done: 0, failed: 0, current: null, jobs: [], isRunning: false, isPaused: false,
  })
  const cancelRef = useRef(false)
  const pauseRef = useRef(false)

  const updateJob = useCallback((id: string, update: Partial<BatchJob>) => {
    setProgress(prev => ({
      ...prev,
      jobs: prev.jobs.map(j => j.id === id ? { ...j, ...update } : j),
    }))
  }, [])

  const runBatch = useCallback(async (
    ids: string[],
    action: (id: string) => Promise<void>,
    opts?: { delayMs?: number },
  ) => {
    const delay = opts?.delayMs ?? ANALYSIS_DELAY_MS
    cancelRef.current = false
    pauseRef.current = false

    const jobs: BatchJob[] = ids.map(id => ({ id, status: 'pending' as const }))
    setProgress({ total: ids.length, done: 0, failed: 0, current: null, jobs, isRunning: true, isPaused: false })

    for (const job of jobs) {
      // Check cancel
      if (cancelRef.current) {
        updateJob(job.id, { status: 'cancelled' })
        continue
      }

      // Check pause
      while (pauseRef.current && !cancelRef.current) {
        await new Promise(r => setTimeout(r, 500))
      }

      updateJob(job.id, { status: 'processing' })
      setProgress(prev => ({ ...prev, current: job.id }))

      try {
        await action(job.id)
        updateJob(job.id, { status: 'done' })
        setProgress(prev => ({ ...prev, done: prev.done + 1 }))
      } catch (e) {
        updateJob(job.id, { status: 'failed', error: e instanceof Error ? e.message : 'Unknown error' })
        setProgress(prev => ({ ...prev, failed: prev.failed + 1 }))
      }

      // Delay between jobs (skip if last job or cancelled)
      if (job.id !== ids[ids.length - 1] && !cancelRef.current) {
        await new Promise(r => setTimeout(r, delay))
      }
    }

    setProgress(prev => ({ ...prev, isRunning: false, current: null }))
  }, [updateJob])

  const cancel = useCallback(() => { cancelRef.current = true }, [])
  const pause = useCallback(() => { pauseRef.current = true; setProgress(prev => ({ ...prev, isPaused: true })) }, [])
  const resume = useCallback(() => { pauseRef.current = false; setProgress(prev => ({ ...prev, isPaused: false })) }, [])
  const reset = useCallback(() => {
    cancelRef.current = false
    pauseRef.current = false
    setProgress({ total: 0, done: 0, failed: 0, current: null, jobs: [], isRunning: false, isPaused: false })
  }, [])

  return { progress, runBatch, cancel, pause, resume, reset, ANALYSIS_DELAY_MS, SCRAPE_DELAY_MS }
}
