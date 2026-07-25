import type { DataSourceRecord } from '../types'
import { withRetry } from '../utils/retry'

const APIFY_BASE = 'https://api.apify.com/v2'
const ACTOR_ID = 'apify~instagram-reel-scraper'

export interface ApifyResult {
  title: string
  creatorHandle: string
  caption: string
  hashtags: string[]
  thumbnailUrl: string
  videoUrl: string
  likeCount: number
  commentCount: number
  duration: number
  transcript: string
}

async function apifyFetch(
  token: string,
  endpoint: string,
  method: string = 'GET',
  payload?: object,
): Promise<unknown> {
  const res = await fetch(`${APIFY_BASE}/${endpoint}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Apify error: ${res.status}`)
  }
  return res.json()
}

export async function startApifyRun(
  apifyApiKey: string,
  reelUrl: string,
): Promise<{ runId: string; datasetId: string }> {
  const token = apifyApiKey.trim()

  const runData = await withRetry(() =>
    apifyFetch(token, `actors/${ACTOR_ID}/runs`, 'POST', {
      username: [reelUrl],
      resultsLimit: 1,
    })
  , { maxRetries: 2 }) as Record<string, unknown>

  const run = runData.data as Record<string, unknown>
  const runId = run?.id as string
  const datasetId = run?.defaultDatasetId as string
  if (!runId) throw new Error('No run ID returned from Apify')

  return { runId, datasetId }
}

export type ApifyRunStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'ABORTED' | 'TIMED-OUT'

export async function pollApifyRun(
  apifyApiKey: string,
  runId: string,
): Promise<{ status: ApifyRunStatus; datasetId?: string }> {
  const token = apifyApiKey.trim()
  const data = await apifyFetch(token, `actor-runs/${runId}`, 'GET') as Record<string, unknown>
  const run = data.data as Record<string, unknown>
  const status = run?.status as ApifyRunStatus
  if (status === 'SUCCEEDED') {
    return { status, datasetId: run.defaultDatasetId as string }
  }
  return { status }
}

export async function fetchApifyDataset(
  apifyApiKey: string,
  datasetId: string,
): Promise<{ result: ApifyResult | null; sources: DataSourceRecord[] }> {
  const sources: DataSourceRecord[] = []
  const token = apifyApiKey.trim()

  const dsData = await apifyFetch(token, `datasets/${datasetId}/items?format=json`, 'GET') as unknown

  if (!dsData || !Array.isArray(dsData) || dsData.length === 0) return { result: null, sources }

  const item = dsData[0] as Record<string, unknown>
  const caption = (item.caption || item.text || '') as string
  const rawHashtags = item.hashtags as string[] | undefined
  const hashtags = rawHashtags || [
    ...new Set<string>(
      (caption.match(/#[\w]+/g) || []).map((h: string) => h.slice(1).toLowerCase())
    ),
  ]

  sources.push({
    source: 'apify',
    fields: ['caption', 'hashtags', 'creatorHandle', 'thumbnailUrl', 'likeCount', 'commentCount', 'duration', 'transcript'],
    cost: 'free-tier',
    timestamp: Date.now(),
  })

  return {
    result: {
      title: caption.split('\n')[0]?.slice(0, 150) || '',
      creatorHandle: (item.ownerUsername || (item.owner as Record<string, unknown>)?.username || '') as string,
      caption,
      hashtags: Array.isArray(hashtags) ? hashtags : [],
      thumbnailUrl: (item.thumbnailUrl || item.displayUrl || '') as string,
      videoUrl: (item.videoUrl || item.downloadUrl || '') as string,
      likeCount: (item.likesCount || item.likeCount || 0) as number,
      commentCount: (item.commentsCount || item.commentCount || 0) as number,
      duration: (item.videoDuration || item.videoDurationSec || 0) as number,
      transcript: (item.transcription || item.transcript || '') as string,
    },
    sources,
  }
}
