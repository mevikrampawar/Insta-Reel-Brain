import type { Reel } from '../types'
import { analyzeReel, generateEmbedding, extractMetadataFromText } from './gemini'

const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
  'https://api.codetabs.com/v1/proxy?quest=',
]

async function fetchWithProxy(url: string): Promise<string> {
  for (const proxy of CORS_PROXIES) {
    try {
      const res = await fetch(proxy + encodeURIComponent(url), {
        signal: AbortSignal.timeout(10000),
      })
      if (res.ok) return await res.text()
    } catch { continue }
  }
  throw new Error('Could not fetch URL. Try pasting the transcript manually.')
}

export async function scrapeInstagramUrl(apiKey: string, url: string): Promise<{
  title: string
  creator: string
  caption: string
  hashtags: string[]
  thumbnailUrl: string
}> {
  const html = await fetchWithProxy(url)

  const getMeta = (name: string) => {
    const match = html.match(new RegExp(`<meta[^>]*(?:property|name)=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i'))
    return match?.[1] || ''
  }

  const ogTitle = getMeta('og:title') || getMeta('twitter:title')
  const ogDesc = getMeta('og:description') || getMeta('description')
  const ogImage = getMeta('og:image')
  const ogVideo = getMeta('og:video')

  const bodyText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 5000)
  const extracted = await extractMetadataFromText(apiKey, url, bodyText)

  const captionText = extracted.caption || ogDesc || ''
  const hashtagMatches = captionText.match(/#[\w]+/g) || []
  const hashtags = [...new Set([...extracted.hashtags, ...hashtagMatches.map(h => h.slice(1))])]
  const creatorFromUrl = url.match(/instagram\.com\/([^/]+)/)?.[1] || ''

  return {
    title: extracted.title || ogTitle || '',
    creator: extracted.creator || creatorFromUrl,
    caption: captionText,
    hashtags,
    thumbnailUrl: ogImage || ogVideo || '',
  }
}

export async function processReel(
  apiKey: string,
  input: {
    url: string
    transcript: string
    title?: string
    creatorHandle?: string
    caption?: string
    hashtags?: string[]
    thumbnailUrl?: string
  },
  reelId: string,
  updateFn: (id: string, data: Partial<Reel>) => Promise<void>,
  onProgress?: (status: string) => void,
): Promise<void> {
  try {
    onProgress?.('Analyzing content with AI...')
    const analysis = await analyzeReel(apiKey, input.transcript, {
      creator: input.creatorHandle,
      caption: input.caption,
      hashtags: input.hashtags,
      title: input.title,
    })

    onProgress?.('Generating search embeddings...')
    const embText = [analysis.summary, ...analysis.keyTakeaways, ...analysis.suggestedTags, input.transcript].join(' ')
    const embedding = await generateEmbedding(apiKey, embText)

    await updateFn(reelId, {
      ingestStatus: 'complete',
      transcript: input.transcript,
      summary: analysis.summary,
      keyTakeaways: analysis.keyTakeaways,
      suggestedTags: analysis.suggestedTags,
      embedding,
      concepts: analysis.concepts.map(c => ({ conceptName: c.name, conceptType: c.type, weight: 0.7 })),
      language: analysis.language,
      thumbnailUrl: input.thumbnailUrl || '',
      ingestedAt: Date.now(),
    })
  } catch (error) {
    await updateFn(reelId, {
      ingestStatus: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Processing failed',
    })
  }
}
