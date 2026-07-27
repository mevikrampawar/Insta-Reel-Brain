import { useState, useEffect, useRef, useCallback } from 'react'
import type { Reel, DataSourceRecord } from '../types'
import { startApifyRun, pollApifyRun, fetchApifyDataset, type ApifyResult } from '../services/apify'
import { processReel } from '../services/ingestion'

export type JobPhase = 'queued' | 'scraping' | 'analyzing' | 'complete' | 'failed'

export interface ScrapeJob {
  id: string
  url: string
  phase: JobPhase
  error?: string
  result?: ApifyResult
  sources?: DataSourceRecord[]
  runId?: string
  datasetId?: string
  reelSource?: 'manual' | 'upload' | 'telegram' | 'ios-shortcut'
}

const POLL_MS = 3000
const TIMEOUT_MS = 120_000
const STORAGE_KEY = 'reelbrain-scrape-queue'

// Only persist essential fields to localStorage (skip large result/source objects)
function serializeJob(job: ScrapeJob): ScrapeJob {
  return {
    id: job.id,
    url: job.url,
    phase: job.phase,
    error: job.error,
    runId: job.runId,
    reelSource: job.reelSource,
  }
}

function loadPersistedJobs(): ScrapeJob[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Only keep jobs that are still in-progress (queued, scraping, analyzing)
    // Complete/failed jobs are stale from a previous session
    return parsed.filter((j: ScrapeJob) => ['queued', 'scraping', 'analyzing'].includes(j.phase))
  } catch {
    return []
  }
}

function persistJobs(jobs: ScrapeJob[]) {
  try {
    const toSave = jobs
      .filter(j => ['queued', 'scraping', 'analyzing'].includes(j.phase))
      .map(serializeJob)
    if (toSave.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch { /* ignore quota errors */ }
}

export function useScrapeQueue(
  apifyApiKey: string,
  groqApiKey: string,
  addReel: (data: Partial<Reel>) => Promise<string | undefined>,
  updateReel: (id: string, data: Partial<Reel>) => Promise<void>,
  assignReelsByCategory?: (reels: { id: string; primaryCategory?: string }[]) => Promise<{ processed: number; assigned: number }>,
  onMasterKeyUsed?: () => Promise<void>,
) {
  const [jobs, setJobs] = useState<ScrapeJob[]>(loadPersistedJobs)
  const mounted = useRef(true)
  const polling = useRef<Set<string>>(new Set())

  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  // Persist jobs to localStorage whenever they change
  useEffect(() => { persistJobs(jobs) }, [jobs])

  const patch = useCallback((id: string, change: Partial<ScrapeJob>) => {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, ...change } : j))
  }, [])

  const remove = useCallback((id: string) => {
    setJobs(prev => prev.filter(j => j.id !== id))
  }, [])

  const pollOnce = useCallback(async (job: ScrapeJob): Promise<boolean> => {
    if (!job.runId) return false
    const { status, datasetId } = await pollApifyRun(apifyApiKey, job.runId)

    if (status === 'SUCCEEDED' && datasetId) {
      const { result, sources } = await fetchApifyDataset(apifyApiKey, datasetId)
      if (!result) {
        patch(job.id, { phase: 'failed', error: 'Apify returned no data' })
        return true
      }

      const reelId = await addReel({
        url: job.url,
        source: job.reelSource || 'manual',
        title: result.title || 'Untitled Reel',
        caption: result.caption,
        hashtags: result.hashtags,
        mentions: result.mentions,
        creatorHandle: result.creatorHandle,
        creatorName: result.creatorName,
        creatorVerified: result.creatorVerified,
        creatorFollowers: result.creatorFollowers,
        creatorProfilePic: result.creatorProfilePic,
        likeCount: result.likeCount,
        commentCount: result.commentCount,
        playCount: result.playCount,
        viewCount: result.viewCount,
        durationSec: result.duration,
        videoUrl: result.videoUrl,
        videoWidth: result.videoWidth,
        videoHeight: result.videoHeight,
        isVideo: result.isVideo,
        audioTrack: result.audioTrack,
        audioArtist: result.audioArtist,
        audioUsesOriginal: result.audioUsesOriginal,
        hasAudio: result.hasAudio,
        thumbnailUrl: result.thumbnailUrl,
        takenAt: result.takenAt,
        shortcode: result.shortcode,
        location: result.location,
        isPaidPartnership: result.isPaidPartnership,
        isAd: result.isAd,
        taggedUsers: result.taggedUsers,
        coauthors: result.coauthors,
        topComments: result.topComments,
        ingestStatus: 'queued',
        dataSources: [
          ...sources,
          { source: 'groq', fields: ['summary', 'keyTakeaways', 'suggestedTags', 'concepts'], cost: 'free', timestamp: Date.now() },
        ],
      })
      if (!reelId) throw new Error('Failed to create reel')

      patch(job.id, { phase: 'analyzing', result, sources, datasetId })

      const analysis = await processReel(groqApiKey, {
        url: job.url,
        transcript: result.transcript || result.caption || '',
        title: result.title,
        creatorHandle: result.creatorHandle,
        caption: result.caption,
        hashtags: result.hashtags,
        thumbnailUrl: result.thumbnailUrl,
      }, reelId, updateReel, () => {})

      // Auto-assign to category collection
      if (assignReelsByCategory && analysis) {
        try {
          await assignReelsByCategory([{ id: reelId, primaryCategory: analysis.primaryCategory }])
        } catch {
          // Non-critical: auto-collection assignment failure shouldn't block the flow
        }
      }

      patch(job.id, { phase: 'complete' })
      if (onMasterKeyUsed) onMasterKeyUsed().catch(() => {})
      setTimeout(() => { if (mounted.current) remove(job.id) }, 5000)
      return true
    }

    if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
      patch(job.id, { phase: 'failed', error: `Apify run ${String(status).toLowerCase()}` })
      return true
    }

    return false
  }, [apifyApiKey, groqApiKey, addReel, updateReel, patch, remove, assignReelsByCategory])

  // On mount: re-start polling for persisted scraping jobs, re-queue persisted queued jobs
  useEffect(() => {
    for (const job of jobs) {
      if (polling.current.has(job.id)) continue

      // Re-start polling for jobs that were in scraping phase with a runId
      if (job.phase === 'scraping' && job.runId) {
        polling.current.add(job.id)
        ;(async () => {
          const deadline = Date.now() + TIMEOUT_MS
          try {
            while (mounted.current && Date.now() < deadline) {
              const done = await pollOnce(job)
              if (done) break
              await new Promise(r => setTimeout(r, POLL_MS))
            }
            if (mounted.current && Date.now() >= deadline) {
              patch(job.id, { phase: 'failed', error: 'Timed out (2 min)' })
            }
          } catch (e) {
            if (mounted.current) {
              patch(job.id, { phase: 'failed', error: e instanceof Error ? e.message : 'Scraping failed' })
            }
          } finally {
            polling.current.delete(job.id)
          }
        })()
      }

      // Re-try jobs that were queued but never started (no runId)
      if (job.phase === 'queued' && !job.runId && apifyApiKey) {
        ;(async () => {
          try {
            const { runId } = await startApifyRun(apifyApiKey, job.url)
            patch(job.id, { phase: 'scraping', runId })
          } catch (e) {
            patch(job.id, { phase: 'failed', error: e instanceof Error ? e.message : 'Failed to start' })
          }
        })()
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs])

  const addJob = useCallback(async (url: string, source?: 'manual' | 'upload' | 'telegram' | 'ios-shortcut') => {
    const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    setJobs(prev => [...prev, { id, url, phase: 'queued', reelSource: source }])

    try {
      const { runId } = await startApifyRun(apifyApiKey, url)
      setJobs(prev => prev.map(j => j.id === id ? { ...j, phase: 'scraping' as const, runId } : j))
    } catch (e) {
      setJobs(prev => prev.map(j => j.id === id ? { ...j, phase: 'failed' as const, error: e instanceof Error ? e.message : 'Failed to start' } : j))
    }
  }, [apifyApiKey])

  return { jobs, addJob, removeJob: remove }
}
