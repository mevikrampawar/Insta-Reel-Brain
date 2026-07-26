import { useMemo } from 'react'
import { FolderOpen, TrendingUp, Heart, MessageCircle, Play, Eye, Brain, Star, Hash } from 'lucide-react'
import type { Reel, Collection } from '../types'
import { computeQualityScore, getQualityLabel, getQualityColor } from '../utils/quality'

interface Props {
  reels: Reel[]
  collections: Collection[]
  onReelClick: (reelId: string) => void
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function hashColor(str: string): string {
  let h = 0
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#8b5cf6', '#f97316']
  return colors[Math.abs(h) % colors.length]
}

export function DashboardView({ reels, collections, onReelClick }: Props) {
  const completeReels = useMemo(() => reels.filter(r => r.ingestStatus === 'complete'), [reels])

  const stats = useMemo(() => {
    const totalLikes = completeReels.reduce((s, r) => s + (r.likeCount || 0), 0)
    const totalComments = completeReels.reduce((s, r) => s + (r.commentCount || 0), 0)
    const totalPlays = completeReels.reduce((s, r) => s + (r.playCount || 0), 0)
    const totalViews = completeReels.reduce((s, r) => s + (r.viewCount || 0), 0)
    const avgQuality = completeReels.length
      ? Math.round(completeReels.reduce((s, r) => s + computeQualityScore(r).overall, 0) / completeReels.length)
      : 0
    return { totalLikes, totalComments, totalPlays, totalViews, avgQuality }
  }, [completeReels])

  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {}
    completeReels.forEach(r => {
      const cat = r.contentCategory || 'other'
      map[cat] = (map[cat] || 0) + 1
    })
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
  }, [completeReels])

  const sentimentBreakdown = useMemo(() => {
    const map: Record<string, number> = {}
    completeReels.forEach(r => {
      const s = r.sentiment || 'neutral'
      map[s] = (map[s] || 0) + 1
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [completeReels])

  const topCreators = useMemo(() => {
    const map: Record<string, { count: number; totalLikes: number; handle: string }> = {}
    completeReels.forEach(r => {
      if (!r.creatorHandle) return
      const key = r.creatorHandle.toLowerCase()
      if (!map[key]) map[key] = { count: 0, totalLikes: 0, handle: r.creatorHandle }
      map[key].count++
      map[key].totalLikes += r.likeCount || 0
    })
    return Object.values(map)
      .sort((a, b) => b.totalLikes - a.totalLikes)
      .slice(0, 5)
  }, [completeReels])

  const trendingReels = useMemo(() => {
    return [...completeReels]
      .sort((a, b) => (b.likeCount + b.commentCount * 2) - (a.likeCount + a.commentCount * 2))
      .slice(0, 5)
  }, [completeReels])

  const topEntities = useMemo(() => {
    const map: Record<string, { name: string; type: string; count: number }> = {}
    completeReels.forEach(r => {
      r.entities?.forEach(e => {
        const key = e.name.toLowerCase()
        if (!map[key]) map[key] = { name: e.name, type: e.type, count: 0 }
        map[key].count++
      })
    })
    return Object.values(map)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [completeReels])

  const topTags = useMemo(() => {
    const map: Record<string, number> = {}
    completeReels.forEach(r => {
      r.suggestedTags?.forEach(t => {
        map[t] = (map[t] || 0) + 1
      })
    })
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
  }, [completeReels])

  const recentReels = useMemo(() => {
    return [...completeReels]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5)
  }, [completeReels])

  const maxCategoryCount = categoryBreakdown.length > 0 ? Math.max(...categoryBreakdown.map(c => c[1])) : 1

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-1">{completeReels.length} reels analyzed · {collections.length} collections</p>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <FolderOpen size={16} className="text-indigo-400" />
            </div>
          </div>
          <p className="text-2xl font-bold">{completeReels.length}</p>
          <p className="text-xs text-zinc-500">Reels</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Brain size={16} className="text-purple-400" />
            </div>
          </div>
          <p className="text-2xl font-bold">{collections.length}</p>
          <p className="text-xs text-zinc-500">Collections</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Heart size={16} className="text-emerald-400" />
            </div>
          </div>
          <p className="text-2xl font-bold">{formatCount(stats.totalLikes)}</p>
          <p className="text-xs text-zinc-500">Total Likes</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Star size={16} className="text-amber-400" />
            </div>
          </div>
          <p className="text-2xl font-bold">{stats.avgQuality}</p>
          <p className="text-xs text-zinc-500">Avg Quality</p>
        </div>
      </div>

      {/* Engagement summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center gap-3">
          <MessageCircle size={14} className="text-blue-400 shrink-0" />
          <div>
            <p className="text-sm font-medium">{formatCount(stats.totalComments)}</p>
            <p className="text-[10px] text-zinc-500">Comments</p>
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center gap-3">
          <Play size={14} className="text-pink-400 shrink-0" />
          <div>
            <p className="text-sm font-medium">{formatCount(stats.totalPlays)}</p>
            <p className="text-[10px] text-zinc-500">Plays</p>
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center gap-3">
          <Eye size={14} className="text-cyan-400 shrink-0" />
          <div>
            <p className="text-sm font-medium">{formatCount(stats.totalViews)}</p>
            <p className="text-[10px] text-zinc-500">Views</p>
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center gap-3">
          <TrendingUp size={14} className="text-orange-400 shrink-0" />
          <div>
            <p className="text-sm font-medium">{topCreators.length}</p>
            <p className="text-[10px] text-zinc-500">Creators</p>
          </div>
        </div>
      </div>

      {/* Two-column layout: Categories + Sentiment | Trending */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Content categories */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-3">Content Categories</h2>
          {categoryBreakdown.length === 0 ? (
            <p className="text-xs text-zinc-600">No data yet</p>
          ) : (
            <div className="space-y-2">
              {categoryBreakdown.map(([cat, count]) => (
                <div key={cat} className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400 w-20 truncate capitalize">{cat}</span>
                  <div className="flex-1 h-5 bg-zinc-800 rounded overflow-hidden">
                    <div
                      className="h-full bg-indigo-500/60 rounded transition-all"
                      style={{ width: `${(count / maxCategoryCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-zinc-500 w-6 text-right">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sentiment */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-3">Sentiment</h2>
          {sentimentBreakdown.length === 0 ? (
            <p className="text-xs text-zinc-600">No data yet</p>
          ) : (
            <div className="space-y-2">
              {sentimentBreakdown.map(([sent, count]) => {
                const color = sent === 'positive' ? 'bg-emerald-500/60'
                  : sent === 'negative' ? 'bg-red-500/60'
                  : 'bg-zinc-500/60'
                const maxSent = Math.max(...sentimentBreakdown.map(s => s[1]))
                return (
                  <div key={sent} className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400 w-20 truncate capitalize">{sent}</span>
                    <div className="flex-1 h-5 bg-zinc-800 rounded overflow-hidden">
                      <div
                        className={`h-full ${color} rounded transition-all`}
                        style={{ width: `${(count / maxSent) * 100}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-zinc-500 w-6 text-right">{count}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Top creators */}
      {topCreators.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-3">Top Creators</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {topCreators.map(c => (
              <div key={c.handle} className="flex items-center gap-3 bg-zinc-800/50 rounded-lg px-3 py-2.5">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ background: hashColor(c.handle) }}
                >
                  {c.handle[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-zinc-300 truncate">@{c.handle}</p>
                  <p className="text-[10px] text-zinc-500">{c.count} reels · {formatCount(c.totalLikes)} likes</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trending reels */}
      {trendingReels.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-3">Trending</h2>
          <div className="space-y-2">
            {trendingReels.map((r, i) => (
              <button
                key={r.id}
                onClick={() => onReelClick(r.id)}
                className="w-full flex items-center gap-3 bg-zinc-800/30 hover:bg-zinc-800/60 rounded-lg px-3 py-2.5 transition-colors text-left"
              >
                <span className="text-lg font-bold text-zinc-700 w-6 text-center shrink-0">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-zinc-300 truncate">{r.title || 'Untitled'}</p>
                  <p className="text-[10px] text-zinc-500">
                    @{r.creatorHandle || 'unknown'} · {formatCount(r.likeCount)} likes · {formatCount(r.commentCount)} comments
                  </p>
                </div>
                <span className={`text-[11px] shrink-0 ${getQualityColor(computeQualityScore(r).overall)}`}>
                  {getQualityLabel(computeQualityScore(r).overall)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Two-column: Entities + Tags */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top entities */}
        {topEntities.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <h2 className="text-sm font-semibold mb-3">Top Entities</h2>
            <div className="flex flex-wrap gap-1.5">
              {topEntities.map(e => (
                <span key={e.name} className="inline-flex items-center gap-1 px-2 py-1 bg-zinc-800 rounded-lg text-[11px] text-zinc-300">
                  {e.name}
                  <span className="text-[9px] text-zinc-600 capitalize">{e.type}</span>
                  <span className="text-[9px] text-zinc-500">×{e.count}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Top tags */}
        {topTags.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <h2 className="text-sm font-semibold mb-3">Top Tags</h2>
            <div className="flex flex-wrap gap-1.5">
              {topTags.map(([tag, count]) => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-500/10 text-indigo-400 rounded-lg text-[11px]">
                  <Hash size={9} className="shrink-0" />
                  {tag}
                  <span className="text-[9px] text-indigo-500">×{count}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recent reels */}
      {recentReels.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-3">Recently Added</h2>
          <div className="space-y-2">
            {recentReels.map(r => (
              <button
                key={r.id}
                onClick={() => onReelClick(r.id)}
                className="w-full flex items-center gap-3 bg-zinc-800/30 hover:bg-zinc-800/60 rounded-lg px-3 py-2.5 transition-colors text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-zinc-300 truncate">{r.title || 'Untitled'}</p>
                  <p className="text-[10px] text-zinc-500">
                    @{r.creatorHandle || 'unknown'} · {new Date(r.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {r.contentCategory && r.contentCategory !== 'other' && (
                  <span className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded capitalize shrink-0">{r.contentCategory}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {completeReels.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
          <Brain size={32} className="text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-zinc-400">No reels yet</p>
          <p className="text-xs text-zinc-600 mt-1">Add your first reel to see your dashboard</p>
        </div>
      )}
    </div>
  )
}
