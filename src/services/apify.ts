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

async function proxyFetch(workerUrl: string, endpoint: string, method: string, payload?: object): Promise<any> {
  const base = workerUrl.trim().startsWith('http') ? workerUrl.trim() : `https://${workerUrl.trim()}`
  const res = await fetch(`${base}?action=apify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint, method, payload }),
  })
  if (!res.ok) throw new Error(`Worker proxy failed: ${res.status}`)
  return res.json()
}

async function corsProxyFetch(url: string, method: string, body?: string): Promise<any> {
  const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(url)}`
  const res = await fetch(proxyUrl, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body,
  })
  if (!res.ok) throw new Error(`CORS proxy failed: ${res.status}`)
  return res.json()
}

async function apifyRequest(workerUrl: string | undefined, endpoint: string, method: string, payload?: object): Promise<any> {
  // Try worker first if configured
  if (workerUrl) {
    try {
      return await proxyFetch(workerUrl, endpoint, method, payload)
    } catch {
      // Worker failed, fall through to CORS proxy
    }
  }
  // Fallback to CORS proxy
  const url = `${APIFY_BASE}/${endpoint}`
  return corsProxyFetch(url, method, payload ? JSON.stringify(payload) : undefined)
}

async function pollRun(workerUrl: string | undefined, runUrl: string, apifyToken: string, maxWaitSec = 90): Promise<string> {
  const deadline = Date.now() + maxWaitSec * 1000
  const endpoint = runUrl.replace('https://api.apify.com/v2/', '')

  while (Date.now() < deadline) {
    try {
      const data = await apifyRequest(workerUrl, `${endpoint}?token=${apifyToken}`, 'GET')
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
  throw new Error('Apify run timed out (90s)')
}

export async function fetchViaApify(
  workerUrl: string | undefined,
  apifyApiKey: string,
  url: string,
): Promise<{ result: ApifyResult | null; sources: DataSourceRecord[] }> {
  const sources: DataSourceRecord[] = []

  try {
    const runData = await apifyRequest(
      workerUrl,
      `acts/${ACTOR_ID}/runs?token=${apifyApiKey}`,
      'POST',
      {
        directUrls: [url],
        addTranscription: true,
        proxyConfiguration: { useApifyProxy: true },
      },
    )

    const datasetId = await pollRun(workerUrl, runData.data.defaultRunUrl, apifyApiKey)

    const dsData = await apifyRequest(
      workerUrl,
      `datasets/${datasetId}/items?token=${apifyApiKey}&format=json`,
      'GET',
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
