export interface DataSourceRecord {
  source: 'graphql' | 'apify' | 'groq'
  fields: string[]
  cost: 'free' | 'free-tier' | 'paid'
  timestamp: number
}

export interface Reel {
  id: string
  userId: string
  url: string
  title: string
  creatorHandle: string
  creatorName: string
  caption: string
  hashtags: string[]
  audioTrack: string
  durationSec: number
  language: string
  thumbnailUrl: string
  source: 'manual' | 'upload' | 'telegram' | 'ios-shortcut'
  ingestStatus: 'queued' | 'scraping' | 'transcribing' | 'analyzing' | 'embedding' | 'complete' | 'failed'
  errorMessage: string
  transcript: string
  summary: string
  keyTakeaways: string[]
  suggestedTags: string[]
  embedding: number[]
  searchableText?: string
  concepts: { conceptName: string; conceptType: string; weight: number }[]
  dataSources: DataSourceRecord[]
  createdAt: number
  updatedAt: number
  ingestedAt: number
}

export interface Collection {
  id: string
  userId: string
  name: string
  description: string
  color: string
  reelIds: string[]
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
