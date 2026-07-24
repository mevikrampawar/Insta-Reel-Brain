const APIFY_BASE = 'https://api.apify.com/v2'

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

export interface DataSourceInfo {
  source: 'graphql' | 'oembed' | 'apify'
  fields: string[]
  cost: 'free' | 'paid'
  timestamp: number
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function pollRun(runUrl: string, token: string, maxWaitSec = 120): Promise<string> {
  const deadline = Date.now() + maxWaitSec * 1000

  while (Date.now() < deadline) {
    const res = await fetch(`${runUrl}?token=${token}`)
    if (!res.ok) throw new Error(`Apify run poll failed: ${res.status}`)
    const data = await res.json()
    const status = data.data?.status

    if (status === 'SUCCEEDED') return data.data.defaultDatasetId
    if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
      throw new Error(`Apify run ${status}`)
    }

    await sleep(2000)
  }
  throw new Error('Apify run timed out')
}

export async function fetchViaApify(
  apifyApiKey: string,
  url: string,
): Promise<{ result: ApifyResult | null; sources: DataSourceInfo[] }> {
  const sources: DataSourceInfo[] = []

  try {
    const runRes = await fetch(
      `${APIFY_BASE}/acts/crawlerbros~instagram-post-scraper/runs?token=${apifyApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postUrls: [url],
          addTranscription: true,
          proxyConfig: { useApifyProxy: true },
        }),
      },
    )

    if (!runRes.ok) {
      const err = await runRes.json().catch(() => ({}))
      throw new Error(err.error?.message || `Apify run start failed: ${runRes.status}`)
    }

    const runData = await runRes.json()
    const datasetId = await pollRun(runData.data.defaultRunUrl, apifyApiKey)

    const datasetRes = await fetch(
      `${APIFY_BASE}/datasets/${datasetId}/items?token=${apifyApiKey}&format=json`,
    )
    if (!datasetRes.ok) throw new Error(`Apify dataset fetch failed: ${datasetRes.status}`)

    const items = await datasetRes.json()
    if (!items || items.length === 0) return { result: null, sources }

    const item = items[0]

    sources.push({
      source: 'apify',
      fields: ['caption', 'hashtags', 'creatorHandle', 'thumbnailUrl', 'likeCount', 'commentCount', 'duration', 'transcript'],
      cost: 'paid',
      timestamp: Date.now(),
    })

    const caption = item.caption || item.text || ''
    const hashtags = [
      ...new Set<string>(
        (caption.match(/#[\w]+/g) || []).map((h: string) => h.slice(1).toLowerCase())
      ),
    ]

    return {
      result: {
        title: caption.split('\n')[0]?.slice(0, 150) || '',
        creatorHandle: item.ownerUsername || item.authorUsername || item.username || '',
        caption,
        hashtags,
        thumbnailUrl: item.thumbnailUrl || item.displayUrl || '',
        videoUrl: item.videoUrl || item.downloadUrl || '',
        likeCount: item.likesCount || item.likeCount || 0,
        commentCount: item.commentsCount || item.commentCount || 0,
        duration: item.videoDurationSec || item.duration || 0,
        transcript: item.transcription || item.transcript || '',
      },
      sources,
    }
  } catch {
    return { result: null, sources }
  }
}

export async function startApifyRun(
  apifyApiKey: string,
  url: string,
): Promise<string | null> {
  try {
    const runRes = await fetch(
      `${APIFY_BASE}/acts/crawlerbros~instagram-post-scraper/runs?token=${apifyApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postUrls: [url],
          addTranscription: true,
          proxyConfig: { useApifyProxy: true },
        }),
      },
    )
    if (!runRes.ok) return null
    const data = await runRes.json()
    return data.data?.defaultRunUrl || null
  } catch {
    return null
  }
}
