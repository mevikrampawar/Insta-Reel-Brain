import type { DataSourceRecord } from '../types'
import { withRetry } from '../utils/retry'

const ACTOR_ID = 'apify/instagram-reel-scraper'
const APIFY_API = 'https://api.apify.com/v2'

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

async function apifyPost(token: string, endpoint: string, payload: object): Promise<unknown> {
  const url = `${APIFY_API}/${endpoint}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Apify error: ${res.status}`)
  }
  return res.json()
}

async function apifyGet(token: string, url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Apify error: ${res.status}`)
  }
  return res.json()
}

async function pollRun(runUrl: string, token: string, maxWaitSec = 120): Promise<string> {
  const deadline = Date.now() + maxWaitSec * 1000

  while (Date.now() < deadline) {
    try {
      const data = await apifyGet(token, runUrl) as Record<string, unknown>
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

  // Start actor run directly
  const runData = await withRetry(() =>
    apifyPost(token, `acts/${ACTOR_ID}/runs`, {
      directUrls: [reelUrl],
      addTranscription: true,
      proxyConfiguration: { useApifyProxy: true },
    })
  , { maxRetries: 2 }) as Record<string, unknown>

  // Poll until done
  const runUrl = (runData.data as Record<string, unknown>)?.defaultRunUrl as string
  if (!runUrl) throw new Error('No run URL returned from Apify')

  const datasetId = await pollRun(runUrl, token)

  // Fetch results
  const dsData = await apifyPost(token, `datasets/${datasetId}/items?format=json`, {}) as unknown

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
