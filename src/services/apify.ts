import type { DataSourceRecord } from '../types'

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

async function apifyFetch(url: string, options?: RequestInit): Promise<any> {
  // Try direct first (works if Apify sends CORS headers)
  try {
    const res = await fetch(url, options)
    if (res.ok) return res.json()
  } catch {
    // CORS blocked, try proxy
  }

  // Fallback to CORS proxy
  const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(url)}`
  const res = await fetch(proxyUrl, options)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Apify request failed: ${res.status}`)
  }
  return res.json()
}

async function pollRun(runUrl: string, apifyToken: string, maxWaitSec = 90): Promise<string> {
  const deadline = Date.now() + maxWaitSec * 1000
  const endpoint = runUrl.replace('https://api.apify.com/v2/', '')

  while (Date.now() < deadline) {
    try {
      const data = await apifyFetch(`${APIFY_BASE}/${endpoint}?token=${apifyToken}`)
      const status = data.data?.status
      if (status === 'SUCCEEDED') return data.data.defaultDatasetId
      if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
        throw new Error(`Apify run ${status.toLowerCase()}`)
      }
    } catch {
      // continue polling
    }
    await sleep(2000)
  }
  throw new Error('Apify timed out (90s)')
}

export async function fetchViaApify(
  apifyApiKey: string,
  url: string,
): Promise<{ result: ApifyResult | null; sources: DataSourceRecord[] }> {
  const sources: DataSourceRecord[] = []

  try {
    // Start actor run
    const runData = await apifyFetch(
      `${APIFY_BASE}/acts/${ACTOR_ID}/runs?token=${apifyApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          directUrls: [url],
          addTranscription: true,
          proxyConfiguration: { useApifyProxy: true },
        }),
      },
    )

    // Poll until done
    const datasetId = await pollRun(runData.data.defaultRunUrl, apifyApiKey)

    // Fetch results
    const dsData = await apifyFetch(
      `${APIFY_BASE}/datasets/${datasetId}/items?token=${apifyApiKey}&format=json`,
    )

    if (!dsData || !Array.isArray(dsData) || dsData.length === 0) return { result: null, sources }

    const item = dsData[0]
    const caption = item.caption || item.text || ''
    const hashtags = item.hashtags || [
      ...new Set<string>(
        (caption.match(/#[\w]+/g) || []).map((h: string) => h.slice(1).toLowerCase())
      ),
    ]

    sources.push({
      source: 'apify',
      fields: ['caption', 'hashtags', 'creatorHandle', 'thumbnailUrl', 'likeCount', 'commentCount', 'duration', 'transcript'],
      cost: 'paid',
      timestamp: Date.now(),
    })

    return {
      result: {
        title: caption.split('\n')[0]?.slice(0, 150) || '',
        creatorHandle: item.ownerUsername || item.owner?.username || '',
        caption,
        hashtags: Array.isArray(hashtags) ? hashtags : [],
        thumbnailUrl: item.thumbnailUrl || item.displayUrl || '',
        videoUrl: item.videoUrl || item.downloadUrl || '',
        likeCount: item.likesCount || item.likeCount || 0,
        commentCount: item.commentsCount || item.commentCount || 0,
        duration: item.videoDuration || item.videoDurationSec || 0,
        transcript: item.transcription || item.transcript || '',
      },
      sources,
    }
  } catch {
    return { result: null, sources }
  }
}
