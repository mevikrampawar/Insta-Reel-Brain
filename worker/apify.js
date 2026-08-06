const APIFY_BASE = 'https://api.apify.com/v2'
const ACTOR_ID = 'apify~instagram-reel-scraper'
const SCRAPE_TIMEOUT_MS = 180_000
const SCRAPE_POLL_MS = 3000

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

async function apifyFetch(env, endpoint, method = 'GET', payload) {
  const token = env.APIFY_API_TOKEN
  if (!token) throw new Error('APIFY_API_TOKEN not configured')
  const res = await fetch(`${APIFY_BASE}/${endpoint}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || err.error || `Apify error: ${res.status}`)
  }
  return res.json()
}

export async function startApifyRun(env, reelUrl, webhookUrl) {
  const input = { username: [reelUrl], resultsLimit: 1, includeTranscript: true }
  if (webhookUrl) {
    input.webhookUrls = [{
      eventTypes: ['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'],
      requestUrl: webhookUrl,
    }]
  }
  const runData = await apifyFetch(env, `actors/${ACTOR_ID}/runs`, 'POST', input)
  const run = runData.data
  const runId = run?.id
  const datasetId = run?.defaultDatasetId
  if (!runId) throw new Error('No run ID returned from Apify')
  return { runId, datasetId }
}

export async function pollApifyRun(env, runId) {
  const data = await apifyFetch(env, `actor-runs/${runId}`)
  const run = data.data
  const status = run?.status
  if (status === 'SUCCEEDED') return { status, datasetId: run.defaultDatasetId }
  return { status }
}

export async function abortApifyRun(env, runId) {
  try {
    await apifyFetch(env, `actor-runs/${runId}`, 'DELETE')
  } catch {
    // Abort is best-effort — a missing/expired run shouldn't break the caller
  }
}

export async function waitForApifyRun(env, runId) {
  const deadline = Date.now() + SCRAPE_TIMEOUT_MS
  while (Date.now() < deadline) {
    let poll
    try {
      poll = await pollApifyRun(env, runId)
    } catch {
      await sleep(SCRAPE_POLL_MS)
      continue
    }
    if (poll.status === 'SUCCEEDED') return { status: poll.status, datasetId: poll.datasetId }
    if (poll.status === 'FAILED' || poll.status === 'ABORTED' || poll.status === 'TIMED-OUT') {
      throw new Error(`Apify run ${String(poll.status).toLowerCase()}`)
    }
    await sleep(SCRAPE_POLL_MS)
  }
  throw new Error('Timed out while scraping')
}

export async function fetchApifyDataset(env, datasetId) {
  const sources = []
  const dsData = await apifyFetch(env, `datasets/${datasetId}/items?format=json`)
  if (!Array.isArray(dsData) || dsData.length === 0) return { result: null, sources }

  const item = dsData[0]
  const owner = item.owner || {}
  const creatorHandle = item.ownerUsername || owner.username || ''
  const creatorName = item.ownerFullName || owner.full_name || ''
  const creatorVerified = item.ownerIsVerified || owner.is_verified || false
  const creatorFollowers = owner.edge_followed_by?.count || owner.followers || 0
  const creatorProfilePic = item.ownerProfilePicUrl || owner.profile_pic_url || ''

  const caption = item.caption || item.text || item.caption_text || ''
  const rawHashtags = item.hashtags
  const hashtags = rawHashtags || [
    ...new Set((caption.match(/#[\w]+/g) || []).map(h => h.slice(1).toLowerCase())),
  ]
  const mentions = item.mentions || []

  const musicInfo = item.musicInfo || item.clips_music_attribution_info || {}
  const commentsRaw = item.latestComments || item.comments || []
  const topComments = commentsRaw.slice(0, 3).map(c => ({
    text: c.text || '',
    author: c.owner?.username || c.ownerUsername || '',
    likes: c.likesCount || c.like_count || 0,
  }))

  const sponsorsRaw = item.sponsors || []
  const sponsors = sponsorsRaw.map(s => s.username || '').filter(Boolean)
  const taggedUsersRaw = item.taggedUsers || item.tagged_user || []
  const taggedUsers = taggedUsersRaw.map(u => u.username || '').filter(Boolean)
  const coauthorsRaw = item.coauthor_producers || item.coauthorUsernames || []
  const coauthors = coauthorsRaw.map(c => typeof c === 'string' ? c : (c.username || '')).filter(Boolean)

  const locationName = item.locationName || ''
  const locationObj = item.location || {}
  const location = locationName || locationObj.name || ''

  const fields = [
    'caption', 'hashtags', 'mentions', 'creatorHandle', 'creatorName', 'creatorVerified',
    'creatorFollowers', 'thumbnailUrl', 'likeCount', 'commentCount', 'playCount', 'viewCount',
    'duration', 'videoUrl', 'audioTrack', 'audioArtist', 'location', 'takenAt',
    'taggedUsers', 'coauthors', 'topComments', 'transcript', 'sponsors',
  ]
  sources.push({ source: 'apify', fields, cost: 'free-tier', timestamp: Date.now() })

  const result = {
    title: caption.split('\n')[0]?.slice(0, 150) || '',
    caption,
    creatorHandle,
    creatorName,
    creatorVerified,
    creatorFollowers,
    creatorProfilePic,
    likeCount: item.likesCount || item.like_count || item.likeCount || 0,
    commentCount: item.commentsCount || item.comment_count || item.commentCount || 0,
    playCount: item.videoPlayCount || item.playsCount || item.play_count || item.playCount || 0,
    viewCount: item.videoViewCount || item.view_count || item.viewCount || 0,
    thumbnailUrl: item.thumbnailUrl || item.displayUrl || item.image || '',
    videoUrl: item.videoUrl || item.downloadUrl || '',
    duration: item.videoDuration || item.video_duration || item.videoDurationSec || 0,
    videoWidth: item.dimensionsWidth || 0,
    videoHeight: item.dimensionsHeight || 0,
    isVideo: item.is_video ?? true,
    audioTrack: musicInfo.song_name || item.audioTitle || '',
    audioArtist: musicInfo.artist_name || item.audioArtist || '',
    audioUsesOriginal: musicInfo.uses_original_audio || false,
    hasAudio: item.has_audio ?? true,
    hashtags: Array.isArray(hashtags) ? hashtags : [],
    mentions,
    takenAt: item.taken_at || '',
    shortcode: item.shortcode || '',
    location,
    isPaidPartnership: item.paidPartnership || item.is_paid_partnership || false,
    isAd: item.is_ad || false,
    taggedUsers,
    coauthors,
    topComments,
    transcript: item.transcription || item.transcript || '',
    sponsors,
  }

  return { result, sources }
}
