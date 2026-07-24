import type { Reel } from '../types'
import { analyzeReel, generateEmbedding } from './gemini'

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
