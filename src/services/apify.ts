import type { DataSourceRecord } from '../types'

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

async function backendPost(backendUrl: string, body: object): Promise<any> {
  const res = await fetch(`${backendUrl}/api/apify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Backend error: ${res.status}`)
  }
  return res.json()
}

async function pollRun(backendUrl: string, runUrl: string, token: string, maxWaitSec = 120): Promise<string> {
  const deadline = Date.now() + maxWaitSec * 1000

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${backendUrl}/api/apify/run?token=${token}&runUrl=${encodeURIComponent(runUrl)}`)
      if (res.ok) {
        const data = await res.json()
        const status = data.data?.status
        if (status === 'SUCCEEDED') return data.data.defaultDatasetId
        if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
          throw new Error(`Apify run ${status.toLowerCase()}`)
        }
      }
    } catch (e: any) {
      if (e.message?.includes('run ')) throw e
    }
    await sleep(3000)
  }
  throw new Error('Apify timed out (2 min)')
}

export async function fetchViaApify(
  apifyApiKey: string,
  reelUrl: string,
  backendUrl?: string,
): Promise<{ result: ApifyResult | null; sources: DataSourceRecord[] }> {
  const sources: DataSourceRecord[] = []
  const token = apifyApiKey.trim()
  const backend = backendUrl?.trim()

  if (!backend) {
    throw new Error('Backend URL not configured. Go to Settings and add your backend URL.')
  }

  // Start actor run through backend
  const runData = await backendPost(backend, {
    token,
    endpoint: `acts/${ACTOR_ID}/runs`,
    payload: {
      directUrls: [reelUrl],
      addTranscription: true,
      proxyConfiguration: { useApifyProxy: true },
    },
  })

  // Poll until done
  const runUrl = runData.data?.defaultRunUrl
  if (!runUrl) throw new Error('No run URL returned from Apify')

  const datasetId = await pollRun(backend, runUrl, token)

  // Fetch results through backend
  const dsData = await backendPost(backend, {
    token,
    endpoint: `datasets/${datasetId}/items?format=json`,
    payload: {},
  })

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
    cost: 'free-tier',
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
}
