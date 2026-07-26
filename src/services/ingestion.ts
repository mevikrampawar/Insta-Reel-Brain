import type { Reel } from '../types'
import { analyzeReel, extractMetadataFromText } from './groq'

export interface ReelAnalysis {
  summary: string
  keyTakeaways: string[]
  suggestedTags: string[]
  concepts: { conceptName: string; conceptType: string; weight: number }[]
  language: string
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
): Promise<ReelAnalysis | null> {
  try {
    let transcript = input.transcript || ''
    let metadata = {
      creator: input.creatorHandle,
      caption: input.caption,
      hashtags: input.hashtags,
      title: input.title,
    }

    if (!transcript && input.caption) {
      onProgress?.('Extracting metadata with AI...')
      try {
        const extracted = await extractMetadataFromText(apiKey, input.url, input.caption)
        if (extracted.title && !metadata.title) metadata.title = extracted.title
        if (extracted.creator && !metadata.creator) metadata.creator = extracted.creator
        if (extracted.caption && !metadata.caption) metadata.caption = extracted.caption
        if (extracted.hashtags?.length && !metadata.hashtags?.length) metadata.hashtags = extracted.hashtags
        transcript = extracted.description || input.caption
      } catch {
        transcript = input.caption
      }
    }

    onProgress?.('Analyzing content with AI...')
    const analysis = await analyzeReel(apiKey, transcript, metadata)

    const searchableText = [
      analysis.summary,
      ...analysis.keyTakeaways,
      ...analysis.suggestedTags,
      ...analysis.concepts.map(c => c.name),
      transcript,
    ].join(' ')

    const concepts = analysis.concepts.map(c => ({ conceptName: c.name, conceptType: c.type, weight: 0.7 }))

    await updateFn(reelId, {
      ingestStatus: 'complete',
      transcript,
      summary: analysis.summary,
      keyTakeaways: analysis.keyTakeaways,
      suggestedTags: analysis.suggestedTags,
      searchableText,
      concepts,
      language: analysis.language,
      ingestedAt: Date.now(),
    })

    return {
      summary: analysis.summary,
      keyTakeaways: analysis.keyTakeaways,
      suggestedTags: analysis.suggestedTags,
      concepts,
      language: analysis.language,
    }
  } catch (error) {
    await updateFn(reelId, {
      ingestStatus: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Processing failed',
    })
    return null
  }
}
