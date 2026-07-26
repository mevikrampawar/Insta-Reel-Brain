import { useMemo } from 'react'
import { motion } from 'motion/react'
import NumberFlow from '@number-flow/react'
import { Sparkline } from 'react-tiny-sparkline'
import { FolderOpen, TrendingUp, Heart, MessageCircle, Play, Eye, Brain, Star, Hash } from 'lucide-react'
import type { Reel, Collection } from '../types'
import { computeQualityScore, getQualityLabel, getQualityColor } from '../utils/quality'
import { formatCount, hashColor } from '../utils/format'

interface Props {
  reels: Reel[]
  collections: Collection[]
  onReelClick: (reelId: string) => void
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
}

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 25 } },
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

  // Sparkline data: reels per day (last 14 days)
  const activitySparkline = useMemo(() => {
    const now = Date.now()
    const dayMs = 86400000
    const days = 14
    const buckets = Array.from({ length: days }, (_, i) => {
      const dayStart = now - (days - 1 - i) * dayMs
      const dayEnd = dayStart + dayMs
      return completeReels.filter(r => r.createdAt >= dayStart && r.createdAt < dayEnd).length
    })
    return buckets
  }, [completeReels])

  // Engagement sparkline
  const engagementSparkline = useMemo(() => {
    const now = Date.now()
    const dayMs = 86400000
    const days = 14
    return Array.from({ length: days }, (_, i) => {
      const dayStart = now - (days - 1 - i) * dayMs
      const dayEnd = dayStart + dayMs
      return completeReels
        .filter(r => r.createdAt >= dayStart && r.createdAt < dayEnd)
        .reduce((sum, r) => sum + (r.likeCount || 0) + (r.commentCount || 0), 0)
    })
  }, [completeReels])

  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {}
    completeReels.forEach(r => {
      const cat = r.contentCategory || 'other'
      map[cat] = (map[cat] || 0) + 1
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6)
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
    return Object.values(map).sort((a, b) => b.totalLikes - a.totalLikes).slice(0, 5)
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
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 10)
  }, [completeReels])

  const topTags = useMemo(() => {
    const map: Record<string, number> = {}
    completeReels.forEach(r => {
      r.suggestedTags?.forEach(t => { map[t] = (map[t] || 0) + 1 })
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10)
  }, [completeReels])

  const recentReels = useMemo(() => {
    return [...completeReels].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5)
  }, [completeReels])

  const maxCategoryCount = categoryBreakdown.length > 0 ? Math.max(...categoryBreakdown.map(c => c[1])) : 1

  return (
    <motion.div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto page-enter" variants={container} initial="hidden" animate="show">
      {/* Header */}
      <motion.div variants={item}>
        <h1 className="text-xl font-bold">Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-1">{completeReels.length} reels analyzed · {collections.length} collections</p>
      </motion.div>

      {/* Overview cards with glass + sparklines */}
      <motion.div className="grid grid-cols-2 md:grid-cols-4 gap-3" variants={item}>
        <div className="glass-card rounded-xl p-4 hover:scale-[1.02] transition-transform">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <FolderOpen size={16} className="text-indigo-400" />
            </div>
            {activitySparkline.some(v => v > 0) && (
              <Sparkline data={activitySparkline} color="#6366f1" width={60} height={20} curved strokeWidth={1.5} />
            )}
          </div>
          <p className="text-2xl font-bold tabular-nums"><NumberFlow value={completeReels.length} /></p>
          <p className="text-xs text-zinc-500">Reels</p>
        </div>
        <div className="glass-card rounded-xl p-4 hover:scale-[1.02] transition-transform">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Brain size={16} className="text-purple-400" />
            </div>
          </div>
          <p className="text-2xl font-bold tabular-nums"><NumberFlow value={collections.length} /></p>
          <p className="text-xs text-zinc-500">Collections</p>
        </div>
        <div className="glass-card rounded-xl p-4 hover:scale-[1.02] transition-transform">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Heart size={16} className="text-emerald-400" />
            </div>
            {engagementSparkline.some(v => v > 0) && (
              <Sparkline data={engagementSparkline} color="#10b981" width={60} height={20} curved strokeWidth={1.5} />
            )}
          </div>
          <p className="text-2xl font-bold tabular-nums"><NumberFlow value={stats.totalLikes} /></p>
          <p className="text-xs text-zinc-500">Total Likes</p>
        </div>
        <div className="glass-card rounded-xl p-4 hover:scale-[1.02] transition-transform">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Star size={16} className="text-amber-400" />
            </div>
          </div>
          <p className="text-2xl font-bold tabular-nums"><NumberFlow value={stats.avgQuality} /></p>
          <p className="text-xs text-zinc-500">Avg Quality</p>
        </div>
      </motion.div>

      {/* Engagement summary */}
      <motion.div className="grid grid-cols-2 md:grid-cols-4 gap-3" variants={item}>
        {[
          { icon: MessageCircle, color: 'text-blue-400', value: stats.totalComments, label: 'Comments' },
          { icon: Play, color: 'text-pink-400', value: stats.totalPlays, label: 'Plays' },
          { icon: Eye, color: 'text-cyan-400', value: stats.totalViews, label: 'Views' },
          { icon: TrendingUp, color: 'text-orange-400', value: topCreators.length, label: 'Creators' },
        ].map(({ icon: Icon, color, value, label }) => (
          <div key={label} className="glass rounded-xl p-3 flex items-center gap-3 hover:bg-white/[0.04] transition-colors">
            <Icon size={14} className={`${color} shrink-0`} />
            <div>
              <p className="text-sm font-medium tabular-nums"><NumberFlow value={value} /></p>
              <p className="text-[10px] text-zinc-500">{label}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Two-column layout */}
      <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-4" variants={item}>
        {/* Content categories */}
        <div className="glass-card rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-3">Content Categories</h2>
          {categoryBreakdown.length === 0 ? (
            <p className="text-xs text-zinc-600">No data yet</p>
          ) : (
            <div className="space-y-2">
              {categoryBreakdown.map(([cat, count]) => (
                <div key={cat} className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400 w-20 truncate capitalize">{cat}</span>
                  <div className="flex-1 h-5 bg-zinc-800/50 rounded overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-indigo-500/60 to-indigo-400/40 rounded"
                      initial={{ width: 0 }}
                      animate={{ width: `${(count / maxCategoryCount) * 100}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                  <span className="text-[11px] text-zinc-500 w-6 text-right tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sentiment */}
        <div className="glass-card rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-3">Sentiment</h2>
          {sentimentBreakdown.length === 0 ? (
            <p className="text-xs text-zinc-600">No data yet</p>
          ) : (
            <div className="space-y-2">
              {(() => {
                const maxSent = Math.max(...sentimentBreakdown.map(s => s[1]))
                return sentimentBreakdown.map(([sent, count]) => {
                  const color = sent === 'positive' ? 'from-emerald-500/60 to-emerald-400/40'
                    : sent === 'negative' ? 'from-red-500/60 to-red-400/40'
                    : 'from-zinc-500/60 to-zinc-400/40'
                  return (
                    <div key={sent} className="flex items-center gap-2">
                      <span className="text-xs text-zinc-400 w-20 truncate capitalize">{sent}</span>
                      <div className="flex-1 h-5 bg-zinc-800/50 rounded overflow-hidden">
                        <motion.div
                          className={`h-full bg-gradient-to-r ${color} rounded`}
                          initial={{ width: 0 }}
                          animate={{ width: `${(count / maxSent) * 100}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                        />
                      </div>
                      <span className="text-[11px] text-zinc-500 w-6 text-right tabular-nums">{count}</span>
                    </div>
                  )
                })
              })()}
            </div>
          )}
        </div>
      </motion.div>

      {/* Top creators */}
      {topCreators.length > 0 && (
        <motion.div className="glass-card rounded-xl p-4" variants={item}>
          <h2 className="text-sm font-semibold mb-3">Top Creators</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {topCreators.map(c => (
              <div key={c.handle} className="flex items-center gap-3 glass rounded-lg px-3 py-2.5 hover:bg-white/[0.04] transition-colors">
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
        </motion.div>
      )}

      {/* Trending reels */}
      {trendingReels.length > 0 && (
        <motion.div className="glass-card rounded-xl p-4" variants={item}>
          <h2 className="text-sm font-semibold mb-3">Trending</h2>
          <div className="space-y-2">
            {trendingReels.map((r, i) => (
              <motion.button
                key={r.id}
                onClick={() => onReelClick(r.id)}
                className="w-full flex items-center gap-3 glass rounded-lg px-3 py-2.5 hover:bg-white/[0.04] transition-colors text-left"
                whileHover={{ x: 4 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
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
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Two-column: Entities + Tags */}
      <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-4" variants={item}>
        {topEntities.length > 0 && (
          <div className="glass-card rounded-xl p-4">
            <h2 className="text-sm font-semibold mb-3">Top Entities</h2>
            <div className="flex flex-wrap gap-1.5">
              {topEntities.map(e => (
                <motion.span key={e.name}
                  className="inline-flex items-center gap-1 px-2 py-1 glass rounded-lg text-[11px] text-zinc-300"
                  whileHover={{ scale: 1.05 }}
                >
                  {e.name}
                  <span className="text-[9px] text-zinc-600 capitalize">{e.type}</span>
                  <span className="text-[9px] text-zinc-500">x{e.count}</span>
                </motion.span>
              ))}
            </div>
          </div>
        )}

        {topTags.length > 0 && (
          <div className="glass-card rounded-xl p-4">
            <h2 className="text-sm font-semibold mb-3">Top Tags</h2>
            <div className="flex flex-wrap gap-1.5">
              {topTags.map(([tag, count]) => (
                <motion.span key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-500/10 text-indigo-400 rounded-lg text-[11px]"
                  whileHover={{ scale: 1.05 }}
                >
                  <Hash size={9} className="shrink-0" />
                  {tag}
                  <span className="text-[9px] text-indigo-500">x{count}</span>
                </motion.span>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* Recent reels */}
      {recentReels.length > 0 && (
        <motion.div className="glass-card rounded-xl p-4" variants={item}>
          <h2 className="text-sm font-semibold mb-3">Recently Added</h2>
          <div className="space-y-2">
            {recentReels.map(r => (
              <motion.button
                key={r.id}
                onClick={() => onReelClick(r.id)}
                className="w-full flex items-center gap-3 glass rounded-lg px-3 py-2.5 hover:bg-white/[0.04] transition-colors text-left"
                whileHover={{ x: 4 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-zinc-300 truncate">{r.title || 'Untitled'}</p>
                  <p className="text-[10px] text-zinc-500">
                    @{r.creatorHandle || 'unknown'} · {new Date(r.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {r.contentCategory && r.contentCategory !== 'other' && (
                  <span className="text-[10px] text-zinc-500 bg-zinc-800/50 px-1.5 py-0.5 rounded capitalize shrink-0">{r.contentCategory}</span>
                )}
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {completeReels.length === 0 && (
        <motion.div className="glass-card rounded-xl p-8 text-center" variants={item}>
          <Brain size={32} className="text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-zinc-400">No reels yet</p>
          <p className="text-xs text-zinc-600 mt-1">Add your first reel to see your dashboard</p>
        </motion.div>
      )}
    </motion.div>
  )
}
