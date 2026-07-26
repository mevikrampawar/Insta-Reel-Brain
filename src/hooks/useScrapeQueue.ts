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
}

const POLL_MS = 3000
const TIMEOUT_MS = 120_000

export function useScrapeQueue(
  apifyApiKey: string,
  groqApiKey: string,
  addReel: (data: Partial<Reel>) => Promise<string | undefined>,
  updateReel: (id: string, data: Partial<Reel>) => Promise<void>,
  autoAssignCollections?: (reelId: string, tags: string[], concepts: { conceptName: string; conceptType: string }[]) => Promise<void>,
) {
  const [jobs, setJobs] = useState<ScrapeJob[]>([])
  const mounted = useRef(true)
  const polling = useRef<Set<string>>(new Set())

  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

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

      // Auto-assign to collections based on AI-generated tags + concepts
      if (autoAssignCollections && analysis) {
        try {
          await autoAssignCollections(reelId, analysis.suggestedTags, analysis.concepts)
        } catch {
          // Non-critical: auto-collection assignment failure shouldn't block the flow
        }
      }

      patch(job.id, { phase: 'complete' })
      setTimeout(() => { if (mounted.current) remove(job.id) }, 5000)
      return true
    }

    if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
      patch(job.id, { phase: 'failed', error: `Apify run ${String(status).toLowerCase()}` })
      return true
    }

    return false
  }, [apifyApiKey, groqApiKey, addReel, updateReel, patch, remove, autoAssignCollections])

  useEffect(() => {
    for (const job of jobs) {
      if (job.phase !== 'scraping' || !job.runId || polling.current.has(job.id)) continue

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs])

  const addJob = useCallback(async (url: string) => {
    const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    setJobs(prev => [...prev, { id, url, phase: 'queued' }])

    try {
      const { runId } = await startApifyRun(apifyApiKey, url)
      setJobs(prev => prev.map(j => j.id === id ? { ...j, phase: 'scraping' as const, runId } : j))
    } catch (e) {
      setJobs(prev => prev.map(j => j.id === id ? { ...j, phase: 'failed' as const, error: e instanceof Error ? e.message : 'Failed to start' } : j))
    }
  }, [apifyApiKey])

  return { jobs, addJob, removeJob: remove }
}
