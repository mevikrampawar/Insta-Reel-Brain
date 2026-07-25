import type { Reel } from '../types'
import { analyzeReel, extractMetadataFromText } from './groq'

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
    // If transcript is empty, try to extract metadata from caption via Groq
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
        // Non-fallback: use caption as transcript
        transcript = input.caption
      }
    }

    onProgress?.('Analyzing content with AI...')
    const analysis = await analyzeReel(apiKey, transcript, metadata)

    // Build TF-IDF searchable text (stored with reel, used at search time)
    const searchableText = [
      analysis.summary,
      ...analysis.keyTakeaways,
      ...analysis.suggestedTags,
      ...analysis.concepts.map(c => c.name),
      transcript,
    ].join(' ')

    await updateFn(reelId, {
      ingestStatus: 'complete',
      transcript,
      summary: analysis.summary,
      keyTakeaways: analysis.keyTakeaways,
      suggestedTags: analysis.suggestedTags,
      embedding: [], // No longer using fake embeddings
      searchableText, // New field for TF-IDF search
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
