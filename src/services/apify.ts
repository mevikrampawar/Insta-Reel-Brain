import type { DataSourceRecord } from '../types'
import { withRetry } from '../utils/retry'

const APIFY_BASE = 'https://api.apify.com/v2'
const ACTOR_ID = 'apify~instagram-reel-scraper'

export interface ApifyResult {
  // Title & caption
  title: string
  caption: string
  // Creator
  creatorHandle: string
  creatorName: string
  creatorVerified: boolean
  creatorFollowers: number
  creatorProfilePic: string
  // Engagement
  likeCount: number
  commentCount: number
  playCount: number
  viewCount: number
  // Media
  thumbnailUrl: string
  videoUrl: string
  duration: number
  videoWidth: number
  videoHeight: number
  isVideo: boolean
  // Audio
  audioTrack: string
  audioArtist: string
  audioUsesOriginal: boolean
  hasAudio: boolean
  // Hashtags & mentions
  hashtags: string[]
  mentions: string[]
  // Metadata
  takenAt: string
  shortcode: string
  location: string
  isPaidPartnership: boolean
  isAd: boolean
  taggedUsers: string[]
  coauthors: string[]
  topComments: { text: string; author: string; likes: number }[]
  // Transcript (from scraper if available)
  transcript: string
  // Sponsors
  sponsors: string[]
}

async function apifyFetch(
  token: string,
  endpoint: string,
  method: string = 'GET',
  payload?: object,
): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)
  try {
    const res = await fetch(`${APIFY_BASE}/${endpoint}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `Apify error: ${res.status}`)
    }
    return res.json()
  } finally {
    clearTimeout(timeout)
  }
}

export async function startApifyRun(
  apifyApiKey: string,
  reelUrl: string,
): Promise<{ runId: string; datasetId: string }> {
  const token = apifyApiKey.trim()

  const runData = await withRetry(() =>
    apifyFetch(token, `actors/${ACTOR_ID}/runs`, 'POST', {
      username: [reelUrl],
      resultsLimit: 1,
      includeTranscript: true,
    })
  , { maxRetries: 2 }) as Record<string, unknown>

  const run = runData.data as Record<string, unknown>
  const runId = run?.id as string
  const datasetId = run?.defaultDatasetId as string
  if (!runId) throw new Error('No run ID returned from Apify')

  return { runId, datasetId }
}

export type ApifyRunStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'ABORTED' | 'TIMED-OUT'

export async function pollApifyRun(
  apifyApiKey: string,
  runId: string,
): Promise<{ status: ApifyRunStatus; datasetId?: string }> {
  const token = apifyApiKey.trim()
  const data = await apifyFetch(token, `actor-runs/${runId}`, 'GET') as Record<string, unknown>
  const run = data.data as Record<string, unknown>
  const status = run?.status as ApifyRunStatus
  if (status === 'SUCCEEDED') {
    return { status, datasetId: run.defaultDatasetId as string }
  }
  return { status }
}

export async function fetchApifyDataset(
  apifyApiKey: string,
  datasetId: string,
): Promise<{ result: ApifyResult | null; sources: DataSourceRecord[] }> {
  const sources: DataSourceRecord[] = []
  const token = apifyApiKey.trim()

  const dsData = await apifyFetch(token, `datasets/${datasetId}/items?format=json`, 'GET') as unknown

  if (!dsData || !Array.isArray(dsData) || dsData.length === 0) return { result: null, sources }

  const item = dsData[0] as Record<string, unknown>

  // Parse owner/creator
  const owner = (item.owner || {}) as Record<string, unknown>
  const creatorHandle = (item.ownerUsername || owner.username || '') as string
  const creatorName = (item.ownerFullName || owner.full_name || '') as string
  const creatorVerified = (item.ownerIsVerified || owner.is_verified || false) as boolean
  const creatorFollowers = ((owner.edge_followed_by as Record<string, unknown>)?.count || owner.followers || 0) as number
  const creatorProfilePic = (item.ownerProfilePicUrl || owner.profile_pic_url || '') as string

  // Parse caption & hashtags
  const caption = (item.caption || item.text || item.caption_text || '') as string
  const rawHashtags = item.hashtags as string[] | undefined
  const hashtags = rawHashtags || [
    ...new Set<string>(
      (caption.match(/#[\w]+/g) || []).map((h: string) => h.slice(1).toLowerCase())
    ),
  ]
  const mentions = (item.mentions || []) as string[]

  // Parse engagement
  const likeCount = (item.likesCount || item.like_count || item.likeCount || 0) as number
  const commentCount = (item.commentsCount || item.comment_count || item.commentCount || 0) as number
  const playCount = (item.videoPlayCount || item.playsCount || item.play_count || item.playCount || 0) as number
  const viewCount = (item.videoViewCount || item.view_count || item.viewCount || 0) as number

  // Parse media
  const thumbnailUrl = (item.thumbnailUrl || item.displayUrl || item.image || '') as string
  const videoUrl = (item.videoUrl || item.downloadUrl || '') as string
  const duration = (item.videoDuration || item.video_duration || item.videoDurationSec || 0) as number
  const videoWidth = (item.dimensionsWidth || 0) as number
  const videoHeight = (item.dimensionsHeight || 0) as number
  const isVideo = (item.is_video ?? true) as boolean

  // Parse audio
  const musicInfo = (item.musicInfo || item.clips_music_attribution_info || {}) as Record<string, unknown>
  const audioTrack = (musicInfo.song_name || item.audioTitle || '') as string
  const audioArtist = (musicInfo.artist_name || item.audioArtist || '') as string
  const audioUsesOriginal = (musicInfo.uses_original_audio || false) as boolean
  const hasAudio = (item.has_audio ?? true) as boolean

  // Parse metadata
  const takenAt = (item.taken_at || '') as string
  const shortcode = (item.shortcode || '') as string
  const locationName = (item.locationName || '') as string
  const locationObj = (item.location || {}) as Record<string, unknown>
  const location = (locationName || locationObj.name || '') as string
  const isPaidPartnership = (item.paidPartnership || item.is_paid_partnership || false) as boolean
  const isAd = (item.is_ad || false) as boolean

  // Parse sponsors
  const sponsorsRaw = (item.sponsors || []) as Record<string, unknown>[]
  const sponsors = sponsorsRaw.map(s => (s.username || '') as string).filter(Boolean)

  // Parse tagged users
  const taggedUsersRaw = (item.taggedUsers || item.tagged_user || []) as Record<string, unknown>[]
  const taggedUsers = taggedUsersRaw.map(u => (u.username || '') as string).filter(Boolean)

  // Parse coauthors
  const coauthorsRaw = (item.coauthor_producers || item.coauthorUsernames || []) as (string | Record<string, unknown>)[]
  const coauthors = coauthorsRaw.map(c => typeof c === 'string' ? c : ((c as Record<string, unknown>).username || '') as string).filter(Boolean)

  // Parse top comments (Apify uses latestComments)
  const commentsRaw = (item.latestComments || item.comments || []) as Record<string, unknown>[]
  const topComments = commentsRaw.slice(0, 3).map(c => ({
    text: (c.text || '') as string,
    author: ((c.owner as Record<string, unknown>)?.username || c.ownerUsername || '') as string,
    likes: (c.likesCount || c.like_count || 0) as number,
  }))

  // Transcript (some scrapers provide this)
  const transcript = (item.transcription || item.transcript || '') as string

  const fields = [
    'caption', 'hashtags', 'mentions', 'creatorHandle', 'creatorName', 'creatorVerified',
    'creatorFollowers', 'thumbnailUrl', 'likeCount', 'commentCount', 'playCount', 'viewCount',
    'duration', 'videoUrl', 'audioTrack', 'audioArtist', 'location', 'takenAt',
    'taggedUsers', 'coauthors', 'topComments', 'transcript', 'sponsors',
  ]

  sources.push({
    source: 'apify',
    fields,
    cost: 'free-tier',
    timestamp: Date.now(),
  })

  return {
    result: {
      title: caption.split('\n')[0]?.slice(0, 150) || '',
      caption,
      creatorHandle,
      creatorName,
      creatorVerified,
      creatorFollowers,
      creatorProfilePic,
      likeCount,
      commentCount,
      playCount,
      viewCount,
      thumbnailUrl,
      videoUrl,
      duration,
      videoWidth,
      videoHeight,
      isVideo,
      audioTrack,
      audioArtist,
      audioUsesOriginal,
      hasAudio,
      hashtags: Array.isArray(hashtags) ? hashtags : [],
      mentions,
      takenAt: takenAt as string,
      shortcode,
      location: typeof location === 'string' ? location : '',
      isPaidPartnership,
      isAd,
      taggedUsers,
      coauthors,
      topComments,
      transcript,
      sponsors,
    },
    sources,
  }
}
