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

export interface DataSourceInfo {
  source: 'graphql' | 'apify'
  fields: string[]
  cost: 'free' | 'paid'
  timestamp: number
}

function normalizeWorkerUrl(url: string): string {
  const trimmed = url.trim()
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  return `https://${trimmed}`
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function proxyFetch(workerUrl: string, endpoint: string, method: string, payload?: object): Promise<{ status: number; data: any }> {
  const normalizedUrl = normalizeWorkerUrl(workerUrl)
  const res = await fetch(`${normalizedUrl}?action=apify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint, method, payload }),
  })
  const data = await res.json()
  return { status: res.status, data }
}

async function pollRun(workerUrl: string, runUrl: string, apifyToken: string, maxWaitSec = 120): Promise<string> {
  const deadline = Date.now() + maxWaitSec * 1000

  while (Date.now() < deadline) {
    const endpoint = runUrl.replace('https://api.apify.com/v2/', '')
    const { status, data } = await proxyFetch(workerUrl, `${endpoint}?token=${apifyToken}`, 'GET')

    if (status >= 200 && status < 300) {
      const runStatus = data.data?.status
      if (runStatus === 'SUCCEEDED') return data.data.defaultDatasetId
      if (runStatus === 'FAILED' || runStatus === 'ABORTED' || runStatus === 'TIMED-OUT') {
        throw new Error(`Apify run ${runStatus.toLowerCase()}`)
      }
    }

    await sleep(2000)
  }
  throw new Error('Apify run timed out (2 min)')
}

export async function fetchViaApify(
  workerUrl: string,
  apifyApiKey: string,
  url: string,
): Promise<{ result: ApifyResult | null; sources: DataSourceInfo[] }> {
  const sources: DataSourceInfo[] = []

  try {
    const { status: runStatus, data: runData } = await proxyFetch(
      workerUrl,
      `acts/${ACTOR_ID}/runs?token=${apifyApiKey}`,
      'POST',
      {
        directUrls: [url],
        addTranscription: true,
        proxyConfiguration: { useApifyProxy: true },
      },
    )

    if (runStatus < 200 || runStatus >= 300) {
      throw new Error(runData?.error?.message || `Apify run failed: ${runStatus}`)
    }

    const datasetId = await pollRun(workerUrl, runData.data.defaultRunUrl, apifyApiKey)

    const { status: dsStatus, data: dsData } = await proxyFetch(
      workerUrl,
      `datasets/${datasetId}/items?token=${apifyApiKey}&format=json`,
      'GET',
    )

    if (dsStatus < 200 || dsStatus >= 300) throw new Error(`Apify dataset failed: ${dsStatus}`)

    if (!dsData || !Array.isArray(dsData) || dsData.length === 0) return { result: null, sources }

    const item = dsData[0]

    sources.push({
      source: 'apify',
      fields: ['caption', 'hashtags', 'creatorHandle', 'thumbnailUrl', 'likeCount', 'commentCount', 'duration', 'transcript'],
      cost: 'paid',
      timestamp: Date.now(),
    })

    const caption = item.caption || item.text || ''
    const hashtags = item.hashtags || [
      ...new Set<string>(
        (caption.match(/#[\w]+/g) || []).map((h: string) => h.slice(1).toLowerCase())
      ),
    ]

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
