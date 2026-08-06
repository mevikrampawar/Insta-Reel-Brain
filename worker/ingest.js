import { fetchApifyDataset } from './apify'
import { analyzeReel, classifyReelHierarchy, extractMetadataFromText } from './groq'

export function normalizeUrl(raw) {
  return (raw || '').trim().replace(/\/+$/, '')
}

export function buildPlaceholderReelFields(uid, url, source) {
  const now = Date.now()
  return {
    userId: uid,
    url,
    urlKey: normalizeUrl(url),
    source,
    title: 'Untitled Reel',
    caption: '',
    hashtags: [],
    mentions: [],
    thumbnailUrl: '',
    creatorHandle: '',
    creatorName: '',
    creatorVerified: false,
    creatorFollowers: 0,
    creatorProfilePic: '',
    likeCount: 0,
    commentCount: 0,
    playCount: 0,
    viewCount: 0,
    durationSec: 0,
    videoUrl: '',
    videoWidth: 0,
    videoHeight: 0,
    isVideo: true,
    audioTrack: '',
    audioArtist: '',
    audioUsesOriginal: false,
    hasAudio: true,
    takenAt: '',
    shortcode: '',
    location: '',
    isPaidPartnership: false,
    isAd: false,
    taggedUsers: [],
    coauthors: [],
    topComments: [],
    transcript: '',
    summary: '',
    keyTakeaways: [],
    suggestedTags: [],
    concepts: [],
    actionItems: [],
    language: '',
    entities: [],
    contentCategory: '',
    primaryCategory: '',
    categoryPath: [],
    sentiment: 'neutral',
    targetAudience: '',
    dataSources: [],
    ingestStatus: 'queued',
    createdAt: now,
    updatedAt: now,
  }
}

function scrapeToReelFields(apifyResult, sources) {
  return {
    title: apifyResult.title || 'Untitled Reel',
    caption: apifyResult.caption || '',
    hashtags: apifyResult.hashtags || [],
    mentions: apifyResult.mentions || [],
    thumbnailUrl: apifyResult.thumbnailUrl || '',
    creatorHandle: apifyResult.creatorHandle || '',
    creatorName: apifyResult.creatorName || '',
    creatorVerified: apifyResult.creatorVerified,
    creatorFollowers: apifyResult.creatorFollowers || 0,
    creatorProfilePic: apifyResult.creatorProfilePic || '',
    likeCount: apifyResult.likeCount || 0,
    commentCount: apifyResult.commentCount || 0,
    playCount: apifyResult.playCount || 0,
    viewCount: apifyResult.viewCount || 0,
    durationSec: apifyResult.duration || 0,
    videoUrl: apifyResult.videoUrl || '',
    videoWidth: apifyResult.videoWidth || 0,
    videoHeight: apifyResult.videoHeight || 0,
    isVideo: apifyResult.isVideo,
    audioTrack: apifyResult.audioTrack || '',
    audioArtist: apifyResult.audioArtist || '',
    audioUsesOriginal: apifyResult.audioUsesOriginal,
    hasAudio: apifyResult.hasAudio,
    takenAt: apifyResult.takenAt || '',
    shortcode: apifyResult.shortcode || '',
    location: apifyResult.location || '',
    isPaidPartnership: apifyResult.isPaidPartnership,
    isAd: apifyResult.isAd,
    taggedUsers: apifyResult.taggedUsers || [],
    coauthors: apifyResult.coauthors || [],
    topComments: apifyResult.topComments || [],
    dataSources: [
      ...(sources || []),
      { source: 'groq', fields: ['summary', 'keyTakeaways', 'suggestedTags', 'concepts'], cost: 'free', timestamp: Date.now() },
    ],
  }
}

export async function runAnalysis(env, url, apifyResult) {
  let transcript = apifyResult.transcript || ''
  const metadata = {
    creator: apifyResult.creatorHandle,
    caption: apifyResult.caption,
    hashtags: apifyResult.hashtags,
    title: apifyResult.title,
  }

  if (!transcript && apifyResult.caption) {
    try {
      const extracted = await extractMetadataFromText(env, url, apifyResult.caption)
      if (extracted.title && !metadata.title) metadata.title = extracted.title
      if (extracted.creator && !metadata.creator) metadata.creator = extracted.creator
      if (extracted.caption && !metadata.caption) metadata.caption = extracted.caption
      if (extracted.hashtags?.length && !metadata.hashtags?.length) metadata.hashtags = extracted.hashtags
      transcript = extracted.description || apifyResult.caption
    } catch {
      transcript = apifyResult.caption
    }
  }

  const analysis = await analyzeReel(env, transcript, metadata)
  const categoryPath = await classifyReelHierarchy(
    env,
    analysis.summary,
    analysis.suggestedTags,
    analysis.entities,
    analysis.contentCategory,
  )
  const primaryCategory = categoryPath[0]

  const searchableText = [
    analysis.summary,
    ...(analysis.keyTakeaways || []),
    ...(analysis.suggestedTags || []),
    ...(analysis.concepts || []).map(c => c.name),
    ...(analysis.entities || []).map(e => e.name),
    transcript,
  ].join(' ')

  return {
    ingestStatus: 'complete',
    transcript,
    summary: analysis.summary,
    keyTakeaways: analysis.keyTakeaways || [],
    suggestedTags: analysis.suggestedTags || [],
    searchableText,
    concepts: (analysis.concepts || []).map(c => ({ conceptName: c.name, conceptType: c.type, weight: 0.7 })),
    actionItems: analysis.actionItems || [],
    language: analysis.language,
    entities: analysis.entities || [],
    contentCategory: analysis.contentCategory || 'other',
    primaryCategory,
    categoryPath,
    sentiment: analysis.sentiment || 'neutral',
    targetAudience: analysis.targetAudience || '',
    ingestedAt: Date.now(),
  }
}

export async function processApifyRun(env, { uid, url, source, datasetId }) {
  if (!datasetId) throw new Error('No Apify dataset to fetch')
  const fetched = await fetchApifyDataset(env, datasetId)
  if (!fetched.result) throw new Error('Apify returned no data — the reel may be private or deleted')
  const scraped = scrapeToReelFields(fetched.result, fetched.sources)
  const analyzed = await runAnalysis(env, url, fetched.result)
  return {
    userId: uid,
    url,
    urlKey: normalizeUrl(url),
    source,
    ...scraped,
    ...analyzed,
    updatedAt: Date.now(),
  }
}
