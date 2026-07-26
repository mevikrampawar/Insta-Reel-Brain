export interface DataSourceRecord {
  source: 'apify' | 'groq'
  fields: string[]
  cost: 'free' | 'free-tier' | 'paid'
  timestamp: number
}

export interface Reel {
  id: string
  userId: string
  url: string
  title: string
  caption: string
  hashtags: string[]
  mentions: string[]
  thumbnailUrl: string
  source: 'manual' | 'upload' | 'telegram' | 'ios-shortcut'
  ingestStatus: 'queued' | 'scraping' | 'analyzing' | 'complete' | 'failed'
  errorMessage: string
  transcript: string
  summary: string
  keyTakeaways: string[]
  suggestedTags: string[]
  searchableText?: string
  concepts: { conceptName: string; conceptType: string; weight: number }[]
  actionItems: string[]
  language: string
  entities: { name: string; type: string }[]
  contentCategory: string
  sentiment: string
  targetAudience: string
  dataSources: DataSourceRecord[]
  createdAt: number
  updatedAt: number
  ingestedAt: number

  // Creator info
  creatorHandle: string
  creatorName: string
  creatorVerified: boolean
  creatorFollowers: number
  creatorProfilePic: string

  // Engagement metrics
  likeCount: number
  commentCount: number
  playCount: number
  viewCount: number

  // Media
  durationSec: number
  videoUrl: string
  videoWidth: number
  videoHeight: number
  isVideo: boolean

  // Audio
  audioTrack: string
  audioArtist: string
  audioUsesOriginal: boolean
  hasAudio: boolean

  // Metadata
  takenAt: string
  shortcode: string
  location: string
  isPaidPartnership: boolean
  isAd: boolean
  taggedUsers: string[]
  coauthors: string[]
  topComments: { text: string; author: string; likes: number }[]
}

export interface Collection {
  id: string
  userId: string
  name: string
  description: string
  color: string
  reelIds: string[]
  isAuto: boolean
  createdAt: number
}

export interface ReelNote {
  id: string
  reelId: string
  userId: string
  content: string
  createdAt: number
  updatedAt: number
}

export interface GraphNode {
  id: string
  name: string
  type: 'reel' | 'concept'
  conceptType?: string
  val: number
}

export interface GraphEdge {
  source: string
  target: string
  weight: number
}

export interface SearchResult {
  reel: Reel
  score: number
  matchType: 'keyword' | 'semantic' | 'combined'
  snippet: string
}
