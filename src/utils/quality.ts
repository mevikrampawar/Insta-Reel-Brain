import type { Reel } from '../types'

export interface QualityScore {
  overall: number // 0-100
  engagement: number // 0-100
  content: number // 0-100
  virality: number // 0-100
}

export function computeQualityScore(reel: Reel): QualityScore {
  const totalEngagement = reel.likeCount + reel.commentCount
  const views = reel.viewCount || reel.playCount || 1
  const engagementRate = Math.min(totalEngagement / views, 1)
  const engagement = Math.round(engagementRate * 100)

  let contentScore = 0
  if (reel.transcript) contentScore += 25
  if (reel.summary) contentScore += 25
  if (reel.keyTakeaways?.length > 0) contentScore += 25
  if (reel.entities?.length > 0) contentScore += 25

  const followers = reel.creatorFollowers || 1
  const playsPerFollower = reel.playCount / followers
  const virality = Math.min(Math.round(playsPerFollower * 10), 100)

  const overall = Math.round(engagement * 0.4 + contentScore * 0.3 + virality * 0.3)

  return { overall, engagement, content: contentScore, virality }
}

export function getQualityLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Average'
  if (score >= 20) return 'Below Average'
  return 'Low'
}

export function getQualityColor(score: number): string {
  if (score >= 80) return 'text-emerald-400'
  if (score >= 60) return 'text-blue-400'
  if (score >= 40) return 'text-yellow-400'
  if (score >= 20) return 'text-orange-400'
  return 'text-red-400'
}
