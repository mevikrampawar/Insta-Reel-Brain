import { useState, useEffect, useRef, useCallback } from 'react'
import type { Reel, DataSourceRecord } from '../types'
import { startApifyRun, pollApifyRun, fetchApifyDataset, abortApifyRun, type ApifyResult, type ApifyRunStatus } from '../services/apify'
import { processReel, type ReelAnalysis } from '../services/ingestion'
import { withTimeout } from '../utils/timeout'

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
  reelId?: string
  reservedMaster?: boolean
  createdAt: number
  startedAt?: number
  updatedAt: number
}

const POLL_MS = 3000
const SCRAPE_TIMEOUT_MS = 180_000
const ANALYZE_TIMEOUT_MS = 300_000
const QUEUED_TIMEOUT_MS = 300_000
const STALE_JOB_MS = 30 * 60_000
const STORAGE_KEY = 'reelbrain-scrape-queue'
const PROCESSED_URLS_KEY = 'reelbrain-processed-urls'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function normalizeUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '')
}

function loadProcessedUrls(): Set<string> {
  try {
    const raw = localStorage.getItem(PROCESSED_URLS_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? new Set(arr) : new Set()
  } catch { return new Set() }
}

function persistProcessedUrls(urls: Set<string>) {
  try {
    const arr = [...urls].slice(-500)
    localStorage.setItem(PROCESSED_URLS_KEY, JSON.stringify(arr))
  } catch { /* ignore */ }
}

// Only persist essential fields to localStorage (skip large result/source objects)
function serializeJob(job: ScrapeJob): ScrapeJob {
  return {
    id: job.id,
    url: job.url,
    phase: job.phase,
    error: job.error,
    runId: job.runId,
    datasetId: job.datasetId,
    reelSource: job.reelSource,
    reelId: job.reelId,
    reservedMaster: job.reservedMaster,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    updatedAt: job.updatedAt,
  }
}

function loadPersistedJobs(): ScrapeJob[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Only keep jobs that are still in-progress (queued, scraping, analyzing).
    // Complete/failed jobs are stale from a previous session.
    return parsed
      .filter((j: ScrapeJob) => ['queued', 'scraping', 'analyzing'].includes(j.phase))
      .map((j: ScrapeJob) => ({
        ...j,
        createdAt: typeof j.createdAt === 'number' ? j.createdAt : 0,
        startedAt: typeof j.startedAt === 'number' ? j.startedAt : undefined,
        updatedAt: typeof j.updatedAt === 'number' ? j.updatedAt : 0,
      }))
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

export type AddJobResult = 'added' | 'duplicate' | 'limit-reached' | 'invalid'

export interface MasterKeyGate {
  canUse: boolean
  reserve: () => Promise<boolean>
  release: () => Promise<void>
}

export function useScrapeQueue(
  apifyApiKey: string,
  groqApiKey: string,
  addReel: (data: Partial<Reel>) => Promise<string | undefined>,
  updateReel: (id: string, data: Partial<Reel>) => Promise<void>,
  assignReelsByCategory?: (reels: { id: string; primaryCategory?: string }[]) => Promise<{ processed: number; assigned: number }>,
  masterKeyGate?: MasterKeyGate,
) {
  const [jobs, setJobs] = useState<ScrapeJob[]>(loadPersistedJobs)
  const [processedUrls, setProcessedUrls] = useState<Set<string>>(loadProcessedUrls)
  const mounted = useRef(true)
  const polling = useRef<Set<string>>(new Set())
  const cancelled = useRef<Set<string>>(new Set())
  const released = useRef<Set<string>>(new Set())
  const jobsRef = useRef<ScrapeJob[]>(jobs)

  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  // Keep a live ref so callbacks (addJob, removeJob) never read stale state
  useEffect(() => { jobsRef.current = jobs }, [jobs])

  // Refund a reserved master-key slot at most once per job
  const releaseIfReserved = useCallback((job: ScrapeJob) => {
    if (!job.reservedMaster || job.phase === 'complete') return
    if (released.current.has(job.id)) return
    released.current.add(job.id)
    masterKeyGate?.release().catch(() => {})
  }, [masterKeyGate])

  // Persist jobs to localStorage whenever they change
  useEffect(() => { persistJobs(jobs) }, [jobs])

  // Persist processed URLs
  useEffect(() => { persistProcessedUrls(processedUrls) }, [processedUrls])

  const patch = useCallback((id: string, change: Partial<ScrapeJob>) => {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, ...change, updatedAt: Date.now() } : j))
  }, [])

  const failJob = useCallback((id: string, error: string) => {
    setJobs(prev => prev.map(j => j.id === id && j.phase !== 'failed'
      ? { ...j, phase: 'failed' as const, error, updatedAt: Date.now() }
      : j))
  }, [])

  // Fully cancels a job: stops polling, aborts the Apify run (frees credit),
  // and un-sticks any reel that was already created so it isn't left "processing".
  const removeJob = useCallback((id: string) => {
    const job = jobsRef.current.find(j => j.id === id)
    cancelled.current.add(id)
    polling.current.delete(id)
    if (job?.runId) abortApifyRun(apifyApiKey, job.runId).catch(() => {})
    if (job?.phase === 'analyzing' && job.reelId) {
      updateReel(job.reelId, { ingestStatus: 'failed', errorMessage: 'Cancelled by user' }).catch(() => {})
    }
    if (job) releaseIfReserved(job)
    setJobs(prev => prev.filter(j => j.id !== id))
  }, [apifyApiKey, updateReel, releaseIfReserved])

  const processJob = useCallback(async (job: ScrapeJob) => {
    // Guard against duplicate processing while a loop is already active
    if (polling.current.has(job.id)) return
    polling.current.add(job.id)
    let current = job
    let completed = false
    try {
      // ── 0) Reserve a master-key slot (atomic) before spending API credits ─
      if (masterKeyGate && !current.reservedMaster) {
        const ok = await masterKeyGate.reserve()
        if (!ok) {
          failJob(current.id, 'Free trial limit reached — add your own Apify API key in Settings to keep saving reels')
          return
        }
        current = { ...current, reservedMaster: true }
        patch(current.id, { reservedMaster: true })
      }

      // ── 1) Start the Apify run if it hasn't started yet ──────────────────
      if (!current.runId && apifyApiKey) {
        const startedAt = Date.now()
        patch(current.id, { phase: 'scraping', startedAt })
        const { runId, datasetId } = await startApifyRun(apifyApiKey, current.url)
        if (!mounted.current || cancelled.current.has(current.id)) {
          abortApifyRun(apifyApiKey, runId).catch(() => {})
          return
        }
        patch(current.id, { runId, datasetId })
        // Keep the local copy in sync so the scrape phase below runs in this
        // same invocation instead of waiting on a re-render to re-enter.
        current = { ...current, phase: 'scraping', startedAt, runId, datasetId }
      }

      // ── 2) Scrape phase — poll until success / failure / timeout ─────────
      if (current.phase === 'scraping' && current.runId) {
        const deadline = Date.now() + SCRAPE_TIMEOUT_MS
        let result: ApifyResult | null = null
        let sources: DataSourceRecord[] = []
        let datasetId = current.datasetId

        while (mounted.current && !cancelled.current.has(current.id) && Date.now() < deadline) {
          let status: ApifyRunStatus
          try {
            const poll = await pollApifyRun(apifyApiKey, current.runId)
            status = poll.status
            if (poll.datasetId) datasetId = poll.datasetId
          } catch {
            // Transient network/poll failure — keep retrying until the deadline
            await sleep(POLL_MS)
            continue
          }

          if (status === 'SUCCEEDED') {
            if (!datasetId) {
              failJob(current.id, 'Apify finished but returned no dataset')
              return
            }
            const fetched = await fetchApifyDataset(apifyApiKey, datasetId)
            result = fetched.result
            sources = fetched.sources
            break
          }
          if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
            failJob(current.id, `Apify run ${String(status).toLowerCase()}`)
            return
          }
          await sleep(POLL_MS)
        }

        if (!mounted.current || cancelled.current.has(current.id)) return
        if (!result) {
          failJob(current.id, Date.now() >= deadline
            ? 'Timed out while scraping (3 min)'
            : 'Apify returned no data — the reel may be private or deleted')
          return
        }

        // ── 3) Create the reel in Firestore ────────────────────────────────
        const reelId = await addReel({
          url: current.url,
          source: current.reelSource || 'manual',
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
        if (!reelId) {
          failJob(current.id, 'Failed to create reel in your library')
          return
        }
        if (cancelled.current.has(current.id) || !mounted.current) {
          updateReel(reelId, { ingestStatus: 'failed', errorMessage: 'Cancelled by user' }).catch(() => {})
          return
        }

        patch(current.id, { phase: 'analyzing', reelId, result, sources, datasetId })
        current = { ...current, phase: 'analyzing', reelId, result, sources, datasetId }
      }

      // ── 4) Analyze phase (fresh or resumed from a previous session) ──────
      if (current.phase === 'analyzing') {
        let result: ApifyResult | null = current.result || null

        if (!result && current.datasetId) {
          // Resume path: re-fetch the dataset from the previous session
          try {
            const fetched = await fetchApifyDataset(apifyApiKey, current.datasetId)
            result = fetched.result
          } catch {
            result = null
          }
          if (!mounted.current || cancelled.current.has(current.id)) return
          if (!result) {
            if (current.reelId) {
              await updateReel(current.reelId, { ingestStatus: 'failed', errorMessage: 'Scrape data expired — re-scrape to retry' }).catch(() => {})
            }
            failJob(current.id, 'Scrape data expired — re-scrape to retry')
            return
          }
        }

        if (!current.reelId) {
          failJob(current.id, 'Analysis interrupted — add this reel again')
          return
        }

        patch(current.id, { phase: 'analyzing', startedAt: Date.now() })
        let analysis: ReelAnalysis | null = null
        try {
          analysis = await withTimeout(
            processReel(groqApiKey, {
              url: current.url,
              transcript: result?.transcript || result?.caption || '',
              title: result?.title,
              creatorHandle: result?.creatorHandle,
              caption: result?.caption,
              hashtags: result?.hashtags,
              thumbnailUrl: result?.thumbnailUrl,
            }, current.reelId, updateReel, () => {}),
            ANALYZE_TIMEOUT_MS,
            'Analysis timed out (5 min)',
          )
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Analysis failed'
          await updateReel(current.reelId, { ingestStatus: 'failed', errorMessage: msg }).catch(() => {})
          failJob(current.id, msg)
          return
        }

        if (cancelled.current.has(current.id) || !mounted.current) {
          updateReel(current.reelId, { ingestStatus: 'failed', errorMessage: 'Cancelled by user' }).catch(() => {})
          return
        }

        // Auto-assign to category collection (non-critical)
        if (assignReelsByCategory && analysis) {
          try {
            await assignReelsByCategory([{ id: current.reelId, primaryCategory: analysis.primaryCategory }])
          } catch {
            // Non-critical: auto-collection assignment failure shouldn't block the flow
          }
        }

        if (cancelled.current.has(current.id) || !mounted.current) return

        patch(current.id, { phase: 'complete', reelId: current.reelId })
        // Mark URL as processed to prevent re-scraping across reloads
        setProcessedUrls(prev => new Set([...prev, normalizeUrl(current.url)]))
        completed = true
      }
    } catch (e) {
      if (mounted.current && !cancelled.current.has(job.id)) {
        failJob(job.id, e instanceof Error ? e.message : 'Processing failed')
      }
    } finally {
      polling.current.delete(job.id)
      if (!completed && current.reservedMaster) releaseIfReserved(current)
    }
  }, [apifyApiKey, groqApiKey, addReel, updateReel, patch, failJob, assignReelsByCategory, masterKeyGate, releaseIfReserved])

  // On mount / key change: resume in-progress jobs, clean up stale ones
  useEffect(() => {
    for (const job of jobs) {
      if (cancelled.current.has(job.id)) continue
      if (job.phase === 'failed' || job.phase === 'complete') continue

      const age = Date.now() - (job.updatedAt || job.createdAt || 0)

      // Jobs from a previous session that stopped updating are dead — fail fast
      // so the user sees what happened instead of an endless "running" row.
      if (age > STALE_JOB_MS) {
        if (job.reelId) {
          updateReel(job.reelId, { ingestStatus: 'failed', errorMessage: 'Processing interrupted — re-run to retry' }).catch(() => {})
        }
        releaseIfReserved(job)
        failJob(job.id, 'Timed out — interrupted (retry to restart)')
        continue
      }

      // Wait for the Apify key before starting; fail if it never arrives
      if (job.phase === 'queued' && !job.runId && !apifyApiKey) {
        if (age > QUEUED_TIMEOUT_MS) {
          releaseIfReserved(job)
          failJob(job.id, 'Timed out waiting to start (no Apify API key)')
        }
        continue
      }

      if (job.phase === 'analyzing' && !job.reelId) {
        releaseIfReserved(job)
        failJob(job.id, 'Analysis interrupted — add this reel again')
        continue
      }

      processJob(job)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, apifyApiKey])

  const addJob = useCallback(async (url: string, source?: 'manual' | 'upload' | 'telegram' | 'ios-shortcut'): Promise<AddJobResult> => {
    // Normalize for dedup
    const normalized = normalizeUrl(url)

    // Check persistent processed set — prevents re-scraping across reloads
    for (const pu of processedUrls) {
      if (normalized.includes(pu) || pu.includes(normalized)) return 'duplicate'
    }

    // Check in-progress queue (live state via ref to avoid stale closures)
    const exists = jobsRef.current.some(j => {
      const jNorm = normalizeUrl(j.url)
      return (jNorm === normalized || normalized.includes(jNorm) || jNorm.includes(normalized)) && j.phase !== 'failed'
    })
    if (exists) return 'duplicate'

    // Don't queue master-key jobs when the free trial is used up
    if (masterKeyGate && !masterKeyGate.canUse) return 'limit-reached'

    const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const now = Date.now()

    setJobs(prev => [...prev, { id, url, phase: 'queued', reelSource: source, createdAt: now, updatedAt: now }])
    return 'added'
  }, [processedUrls, masterKeyGate])

  return { jobs, addJob, removeJob }
}
