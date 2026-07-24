export interface InstagramMetadata {
  title: string
  creatorHandle: string
  caption: string
  hashtags: string[]
  thumbnailUrl: string
  videoUrl: string
  likeCount: number
  commentCount: number
  duration: number
}

export interface DataSourceInfo {
  source: 'graphql' | 'oembed' | 'apify'
  fields: string[]
  cost: 'free' | 'paid'
  timestamp: number
}

function extractShortcode(url: string): string | null {
  const match = url.match(/instagram\.com\/reel\/([A-Za-z0-9_-]+)/)
    || url.match(/instagram\.com\/p\/([A-Za-z0-9_-]+)/)
    || url.match(/instagram\.com\/tv\/([A-Za-z0-9_-]+)/)
  return match?.[1] || null
}

async function fetchViaGraphQL(workerUrl: string, shortcode: string): Promise<{ result: InstagramMetadata | null; fields: string[] }> {
  try {
    const res = await fetch(workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shortcode }),
    })
    if (!res.ok) return { result: null, fields: [] }
    const data = await res.json()
    if (!data) return { result: null, fields: [] }

    const media = data.shortcode_media || data
    const caption = media.edge_media_to_caption?.edges?.[0]?.node?.text || ''
    const hashtags = [...new Set<string>(
      (caption.match(/#[\w]+/g) || []).map((h: string) => h.slice(1).toLowerCase())
    )]
    const owner = media.owner || {}
    const fields: string[] = []

    const result: InstagramMetadata = {
      title: '',
      creatorHandle: owner.username || '',
      caption,
      hashtags,
      thumbnailUrl: media.thumbnail_src || media.display_url || '',
      videoUrl: media.video_url || '',
      likeCount: media.edge_media_preview_like?.count || 0,
      commentCount: media.edge_media_preview_comment?.count || 0,
      duration: media.video_duration || 0,
    }

    if (result.title) fields.push('title')
    if (result.creatorHandle) fields.push('creatorHandle')
    if (result.caption) fields.push('caption')
    if (result.hashtags.length > 0) fields.push('hashtags')
    if (result.thumbnailUrl) fields.push('thumbnailUrl')
    if (result.videoUrl) fields.push('videoUrl')
    if (result.likeCount > 0) fields.push('likeCount')
    if (result.commentCount > 0) fields.push('commentCount')
    if (result.duration > 0) fields.push('duration')

    return { result, fields }
  } catch {
    return { result: null, fields: [] }
  }
}

async function fetchViaoEmbed(url: string): Promise<{ result: InstagramMetadata | null; fields: string[] }> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v25.0/instagram_oembed?url=${encodeURIComponent(url)}&fields=author_name,thumbnail_url,html`
    )
    if (!res.ok) return { result: null, fields: [] }
    const data = await res.json()

    const fields: string[] = []
    const result: InstagramMetadata = {
      title: '',
      creatorHandle: data.author_name || '',
      caption: '',
      hashtags: [],
      thumbnailUrl: data.thumbnail_url || '',
      videoUrl: '',
      likeCount: 0,
      commentCount: 0,
      duration: 0,
    }

    if (result.creatorHandle) fields.push('creatorHandle')
    if (result.thumbnailUrl) fields.push('thumbnailUrl')

    return { result, fields }
  } catch {
    return { result: null, fields: [] }
  }
}

export async function fetchInstagramMetadata(
  url: string,
  workerUrl?: string,
): Promise<{ metadata: InstagramMetadata | null; sources: DataSourceInfo[] }> {
  const sources: DataSourceInfo[] = []
  const merged: InstagramMetadata = {
    title: '', creatorHandle: '', caption: '', hashtags: [],
    thumbnailUrl: '', videoUrl: '', likeCount: 0, commentCount: 0, duration: 0,
  }

  if (workerUrl) {
    const shortcode = extractShortcode(url)
    if (shortcode) {
      const { result, fields } = await fetchViaGraphQL(workerUrl, shortcode)
      if (result) {
        if (result.title) merged.title = result.title
        if (result.creatorHandle) merged.creatorHandle = result.creatorHandle
        if (result.caption) merged.caption = result.caption
        if (result.hashtags.length > 0) merged.hashtags = result.hashtags
        if (result.thumbnailUrl) merged.thumbnailUrl = result.thumbnailUrl
        if (result.videoUrl) merged.videoUrl = result.videoUrl
        if (result.likeCount > 0) merged.likeCount = result.likeCount
        if (result.commentCount > 0) merged.commentCount = result.commentCount
        if (result.duration > 0) merged.duration = result.duration
        if (fields.length > 0) {
          sources.push({ source: 'graphql', fields, cost: 'free', timestamp: Date.now() })
        }
      }
    }
  }

  if (!merged.creatorHandle) {
    const { result, fields } = await fetchViaoEmbed(url)
    if (result) {
      if (!merged.creatorHandle && result.creatorHandle) merged.creatorHandle = result.creatorHandle
      if (!merged.thumbnailUrl && result.thumbnailUrl) merged.thumbnailUrl = result.thumbnailUrl
      if (fields.length > 0) {
        sources.push({ source: 'oembed', fields, cost: 'free', timestamp: Date.now() })
      }
    }
  }

  const hasData = merged.creatorHandle || merged.caption || merged.thumbnailUrl
  return {
    metadata: hasData ? merged : null,
    sources,
  }
}

export function isInstagramUrl(url: string): boolean {
  return /instagram\.com\/(reel|p|tv)\//.test(url)
}
