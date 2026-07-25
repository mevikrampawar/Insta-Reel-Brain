import type { DataSourceRecord } from '../types'
import { withRetry } from '../utils/retry'

const APIFY_BASE = 'https://api.apify.com/v2'
const ACTOR_ID = 'apify/instagram-reel-scraper'

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

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
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

async function pollRun(runUrl: string, token: string, maxWaitSec = 120): Promise<string> {
  const deadline = Date.now() + maxWaitSec * 1000
  const relativePath = runUrl.replace(`${APIFY_BASE}/`, '')

  while (Date.now() < deadline) {
    try {
      const data = await apifyFetch(token, relativePath, 'GET') as Record<string, unknown>
      const status = (data.data as Record<string, unknown>)?.status
      if (status === 'SUCCEEDED') return (data.data as Record<string, unknown>).defaultDatasetId as string
      if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
        throw new Error(`Apify run ${String(status).toLowerCase()}`)
      }
    } catch (e) {
      if (e instanceof Error && (e.message?.includes('Apify run') || e.message?.includes('Apify error'))) throw e
    }
    await sleep(3000)
  }
  throw new Error('Apify timed out (2 min)')
}

export async function fetchViaApify(
  apifyApiKey: string,
  reelUrl: string,
): Promise<{ result: ApifyResult | null; sources: DataSourceRecord[] }> {
  const sources: DataSourceRecord[] = []
  const token = apifyApiKey.trim()

  const runData = await withRetry(() =>
    apifyFetch(token, `acts/${ACTOR_ID}/runs`, 'POST', {
      directUrls: [reelUrl],
      addTranscription: true,
      proxyConfiguration: { useApifyProxy: true },
    })
  , { maxRetries: 2 }) as Record<string, unknown>

  const runUrl = (runData.data as Record<string, unknown>)?.defaultRunUrl as string
  if (!runUrl) throw new Error('No run URL returned from Apify')

  const datasetId = await pollRun(runUrl, token)

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
