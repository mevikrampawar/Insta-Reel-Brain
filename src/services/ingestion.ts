import type { Reel } from '../types'
import { analyzeReel, classifyReelHierarchy, extractMetadataFromText } from './groq'

export interface ReelAnalysis {
  summary: string
  keyTakeaways: string[]
  suggestedTags: string[]
  concepts: { conceptName: string; conceptType: string; weight: number }[]
  actionItems: string[]
  language: string
  entities: { name: string; type: string }[]
  contentCategory: string
  primaryCategory: string
  categoryPath: string[]
  sentiment: string
  targetAudience: string
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

    onProgress?.('Classifying into category...')
    const categoryPath = await classifyReelHierarchy(
      apiKey,
      analysis.summary,
      analysis.suggestedTags,
      analysis.entities,
      analysis.contentCategory,
    )
    const primaryCategory = categoryPath[0]

    const searchableText = [
      analysis.summary,
      ...analysis.keyTakeaways,
      ...analysis.suggestedTags,
      ...analysis.concepts.map(c => c.name),
      ...analysis.entities.map(e => e.name),
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
      actionItems: analysis.actionItems || [],
      language: analysis.language,
      entities: analysis.entities || [],
      contentCategory: analysis.contentCategory || 'other',
      primaryCategory,
      categoryPath,
      sentiment: analysis.sentiment || 'neutral',
      targetAudience: analysis.targetAudience || '',
      ingestedAt: Date.now(),
    })

    return {
      summary: analysis.summary,
      keyTakeaways: analysis.keyTakeaways,
      suggestedTags: analysis.suggestedTags,
      concepts,
      actionItems: analysis.actionItems || [],
      language: analysis.language,
      entities: analysis.entities || [],
      contentCategory: analysis.contentCategory || 'other',
      primaryCategory,
      categoryPath,
      sentiment: analysis.sentiment || 'neutral',
      targetAudience: analysis.targetAudience || '',
    }
  } catch (error) {
    await updateFn(reelId, {
      ingestStatus: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Processing failed',
    })
    return null
  }
}
