import { useState, useEffect, useRef, useCallback } from 'react'
import type { Reel, DataSourceRecord } from '../types'
import { startApifyRun, pollApifyRun, fetchApifyDataset, type ApifyResult } from '../services/apify'
import { processReel } from '../services/ingestion'

export type JobPhase = 'queued' | 'scraping' | 'scraped' | 'analyzing' | 'complete' | 'failed'

export interface ScrapeJob {
  id: string
  url: string
  phase: JobPhase
  error?: string
  result?: ApifyResult
  sources?: DataSourceRecord[]
  runUrl?: string
  datasetId?: string
}

const POLL_INTERVAL = 3000

export function useScrapeQueue(
  apifyApiKey: string,
  groqApiKey: string,
  addReel: (data: Partial<Reel>) => Promise<string | undefined>,
  updateReel: (id: string, data: Partial<Reel>) => Promise<void>,
) {
  const [jobs, setJobs] = useState<ScrapeJob[]>([])
  const jobsRef = useRef(jobs)
  jobsRef.current = jobs
  const activePolls = useRef<Set<string>>(new Set())
  const mountedRef = useRef(true)

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])

  const updateJob = useCallback((id: string, patch: Partial<ScrapeJob>) => {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, ...patch } : j))
  }, [])

  const removeJob = useCallback((id: string) => {
    setJobs(prev => prev.filter(j => j.id !== id))
  }, [])

  const pollJob = useCallback(async (job: ScrapeJob) => {
    if (activePolls.current.has(job.id)) return
    activePolls.current.add(job.id)

    const token = apifyApiKey.trim()
    const deadline = Date.now() + 120_000

    try {
      while (mountedRef.current && Date.now() < deadline) {
        const { status, datasetId } = await pollApifyRun(job.runUrl!, token)

        if (status === 'SUCCEEDED' && datasetId) {
          updateJob(job.id, { phase: 'scraped', datasetId })

          const { result, sources } = await fetchApifyDataset(apifyApiKey, datasetId)
          if (!result) {
            updateJob(job.id, { phase: 'failed', error: 'Apify returned no data' })
            return
          }

          updateJob(job.id, { phase: 'analyzing', result, sources })

          const reelId = await addReel({
            url: job.url,
            title: result.title || 'Untitled Reel',
            creatorHandle: result.creatorHandle,
            caption: result.caption,
            hashtags: result.hashtags,
            thumbnailUrl: result.thumbnailUrl,
            ingestStatus: 'queued',
            dataSources: [
              ...sources,
              { source: 'groq', fields: ['summary', 'keyTakeaways', 'suggestedTags', 'concepts'], cost: 'free', timestamp: Date.now() },
            ],
          })
          if (!reelId) throw new Error('Failed to create reel')

          await processReel(groqApiKey, {
            url: job.url,
            transcript: result.transcript || result.caption || '',
            title: result.title,
            creatorHandle: result.creatorHandle,
            caption: result.caption,
            hashtags: result.hashtags,
            thumbnailUrl: result.thumbnailUrl,
          }, reelId, updateReel, () => {})

          updateJob(job.id, { phase: 'complete' })
          setTimeout(() => { if (mountedRef.current) removeJob(job.id) }, 5000)
          return
        }

        if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
          updateJob(job.id, { phase: 'failed', error: `Apify run ${status.toLowerCase()}` })
          return
        }

        await new Promise(r => setTimeout(r, POLL_INTERVAL))
      }

      updateJob(job.id, { phase: 'failed', error: 'Timed out (2 min)' })
    } catch (e) {
      updateJob(job.id, { phase: 'failed', error: e instanceof Error ? e.message : 'Scraping failed' })
    } finally {
      activePolls.current.delete(job.id)
    }
  }, [apifyApiKey, groqApiKey, addReel, updateReel, updateJob, removeJob])

  useEffect(() => {
    for (const job of jobs) {
      if (job.phase === 'scraping' && job.runUrl) {
        pollJob(job)
      }
    }
  }, [jobs, pollJob])

  const addJob = useCallback(async (url: string) => {
    const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const job: ScrapeJob = { id, url, phase: 'queued' }
    setJobs(prev => [...prev, job])

    try {
      updateJob(id, { phase: 'scraping' })
      const { runUrl } = await startApifyRun(apifyApiKey, url)
      updateJob(id, { runUrl })
    } catch (e) {
      updateJob(id, { phase: 'failed', error: e instanceof Error ? e.message : 'Failed to start scrape' })
    }
  }, [apifyApiKey, updateJob])

  return { jobs, addJob, removeJob }
}
