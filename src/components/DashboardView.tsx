import { useMemo } from 'react'
import { motion } from 'motion/react'
import NumberFlow from '@number-flow/react'
import { Sparkline } from 'react-tiny-sparkline'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Brain, FolderOpen, Hash, Plus, ArrowRight, Search, Smartphone, TrendingUp } from 'lucide-react'
import type { Reel, Collection } from '../types'
import { computeQualityScore, getQualityLabel, getQualityColor } from '../utils/quality'
import { formatCount } from '../utils/format'

interface Props {
  reels: Reel[]
  collections: Collection[]
  onReelClick: (reelId: string) => void
  onFilterNavigate: (filters: { categories?: string[]; creator?: string }, highlightReelId?: string) => void
  needsOnboarding?: boolean
  onGoToIngest?: () => void
  onGoToLibrary?: () => void
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
}

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 25 } },
}

const categoryGradients: Record<string, string> = {
  'fitness': 'from-orange-500 to-red-600',
  'education': 'from-blue-500 to-indigo-600',
  'comedy': 'from-yellow-400 to-orange-500',
  'cooking': 'from-green-500 to-emerald-600',
  'tech': 'from-cyan-500 to-blue-600',
  'fashion': 'from-pink-500 to-purple-600',
  'music': 'from-purple-500 to-indigo-600',
  'travel': 'from-teal-400 to-cyan-600',
  'other': 'from-zinc-500 to-zinc-600',
}

function getCategoryGradient(category: string): string {
  return categoryGradients[category] || categoryGradients['other']
}

export function DashboardView({ reels, collections, onReelClick, onFilterNavigate, needsOnboarding, onGoToIngest, onGoToLibrary }: Props) {
  const completeReels = useMemo(() => reels.filter(r => r.ingestStatus === 'complete'), [reels])

  const stats = useMemo(() => {
    const avgQuality = completeReels.length
      ? Math.round(completeReels.reduce((s, r) => s + computeQualityScore(r).overall, 0) / completeReels.length)
      : 0
    const allTags = new Set<string>()
    completeReels.forEach(r => r.suggestedTags?.forEach(t => allTags.add(t)))
    return { avgQuality, uniqueTags: allTags.size }
  }, [completeReels])

  const activitySparkline = useMemo(() => {
    const now = Date.now()
    const dayMs = 86400000
    const days = 14
    return Array.from({ length: days }, (_, i) => {
      const dayStart = now - (days - 1 - i) * dayMs
      const dayEnd = dayStart + dayMs
      return completeReels.filter(r => r.createdAt >= dayStart && r.createdAt < dayEnd).length
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

  const trendingReels = useMemo(() => {
    return [...completeReels]
      .sort((a, b) => (b.likeCount + b.commentCount * 2) - (a.likeCount + a.commentCount * 2))
      .slice(0, 5)
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
    <motion.div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto page-enter" data-tour="dashboard" variants={container} initial="hidden" animate="show">

      {/* Empty state — onboarding for new users */}
      {completeReels.length === 0 && needsOnboarding && (
        <motion.div className="space-y-8 py-8" variants={item} data-tour="dashboard-empty">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto shadow-2xl shadow-indigo-500/25">
              <Brain size={40} />
            </div>
            <div>
              <h1 className="text-3xl font-bold mb-2">Welcome to Reel Brain</h1>
              <p className="text-zinc-400 max-w-md mx-auto">
                Your AI-powered knowledge base for Instagram Reels. Save reels, and AI will transcribe, summarize, tag, and organize them for you.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
            <div className="glass-card rounded-xl p-5 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Smartphone size={20} className="text-blue-400" />
              </div>
              <h3 className="font-semibold text-sm">1. Copy a reel link</h3>
              <p className="text-xs text-zinc-500">From Instagram's share menu</p>
            </div>
            <div className="glass-card rounded-xl p-5 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Plus size={20} className="text-purple-400" />
              </div>
              <h3 className="font-semibold text-sm">2. Paste it here</h3>
              <p className="text-xs text-zinc-500">AI analyzes it automatically</p>
            </div>
            <div className="glass-card rounded-xl p-5 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Brain size={20} className="text-emerald-400" />
              </div>
              <h3 className="font-semibold text-sm">3. Build your brain</h3>
              <p className="text-xs text-zinc-500">Search, chat, and explore</p>
            </div>
          </div>

          <div className="text-center">
            <Button size="lg" onClick={onGoToIngest} className="gap-2">
              <Plus size={16} /> Add your first reel <ArrowRight size={16} />
            </Button>
            <p className="text-[10px] text-zinc-600 mt-3">You have 5 free reels with trial API keys. Add your own keys in Settings for unlimited use.</p>
          </div>
        </motion.div>
      )}

      {/* Quick actions */}
      {completeReels.length > 0 && (
        <motion.div className="flex items-center gap-3" variants={item}>
          <Button onClick={onGoToIngest} className="gap-2">
            <Plus size={16} /> Add Reel
          </Button>
          <Button variant="outline" className="gap-2" onClick={onGoToLibrary}>
            <Search size={16} /> Search Library
          </Button>
        </motion.div>
      )}

      {/* Stats row */}
      {completeReels.length > 0 && (
        <motion.div className="grid grid-cols-2 md:grid-cols-4 gap-3" variants={item} data-tour="stats">
          <Card className="glass-card p-4 hover:scale-[1.02] transition-transform">
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
          </Card>
          <Card className="glass-card p-4 hover:scale-[1.02] transition-transform">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center mb-2">
              <Brain size={16} className="text-purple-400" />
            </div>
            <p className="text-2xl font-bold tabular-nums"><NumberFlow value={collections.length} /></p>
            <p className="text-xs text-zinc-500">Collections</p>
          </Card>
          <Card className="glass-card p-4 hover:scale-[1.02] transition-transform">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center mb-2">
              <TrendingUp size={16} className="text-amber-400" />
            </div>
            <p className="text-2xl font-bold tabular-nums"><NumberFlow value={stats.avgQuality} /></p>
            <p className="text-xs text-zinc-500">Avg Quality</p>
          </Card>
          <Card className="glass-card p-4 hover:scale-[1.02] transition-transform">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-2">
              <Hash size={16} className="text-emerald-400" />
            </div>
            <p className="text-2xl font-bold tabular-nums"><NumberFlow value={stats.uniqueTags} /></p>
            <p className="text-xs text-zinc-500">Unique Tags</p>
          </Card>
        </motion.div>
      )}

      {/* Trending section */}
      {trendingReels.length > 0 && (
        <motion.div variants={item}>
          <h2 className="text-sm font-semibold mb-3">Trending</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-5 md:overflow-visible scrollbar-hide">
            {trendingReels.map((r, i) => (
              <motion.button
                key={r.id}
                onClick={() => onReelClick(r.id)}
                className="glass-card rounded-xl overflow-hidden min-w-[200px] md:min-w-0 text-left hover:scale-[1.02] transition-transform flex-shrink-0"
                whileHover={{ y: -2 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <div className={cn('h-20 bg-gradient-to-br', getCategoryGradient(r.contentCategory), 'flex items-end p-2')}>
                  <span className="text-lg font-bold text-white/80">{i + 1}</span>
                </div>
                <div className="p-3 space-y-1">
                  <p className="text-xs font-medium text-zinc-200 truncate">{r.title || 'Untitled'}</p>
                  <p className="text-[10px] text-zinc-500 truncate">@{r.creatorHandle || 'unknown'}</p>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                    <span>{formatCount(r.likeCount)} likes</span>
                    <span>·</span>
                    <span>{formatCount(r.commentCount)} comments</span>
                  </div>
                  <span className={cn('text-[11px]', getQualityColor(computeQualityScore(r).overall))}>
                    {getQualityLabel(computeQualityScore(r).overall)}
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Top Tags — horizontal scrollable pills */}
      {topTags.length > 0 && (
        <motion.div variants={item}>
          <h2 className="text-sm font-semibold mb-3">Top Tags</h2>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {topTags.map(([tag, count]) => (
              <motion.button
                key={tag}
                onClick={() => {
                  const reel = completeReels.find(r => r.suggestedTags?.includes(tag))
                  if (reel) onFilterNavigate({ categories: [reel.contentCategory] }, reel.id)
                }}
                className="flex-shrink-0"
                whileHover={{ scale: 1.05 }}
              >
                <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-white/10 transition-colors">
                  <Hash size={10} />
                  {tag}
                  <span className="text-zinc-500 ml-0.5">x{count}</span>
                </Badge>
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Category breakdown */}
      {categoryBreakdown.length > 0 && (
        <motion.div variants={item}>
          <h2 className="text-sm font-semibold mb-3">Content Categories</h2>
          <div className="space-y-2">
            {categoryBreakdown.map(([cat, count]) => (
              <button
                key={cat}
                onClick={() => onFilterNavigate({ categories: [cat] })}
                className="w-full flex items-center gap-2 group hover:bg-white/[0.02] rounded-lg px-1 py-0.5 -mx-1 transition-colors"
              >
                <span className="text-xs text-zinc-400 w-20 truncate capitalize group-hover:text-indigo-400 transition-colors">{cat}</span>
                <div className="flex-1 h-5 bg-zinc-800/50 rounded overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-indigo-500/60 to-indigo-400/40 rounded"
                    initial={{ width: 0 }}
                    animate={{ width: `${(count / maxCategoryCount) * 100}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                </div>
                <span className="text-[11px] text-zinc-500 w-6 text-right tabular-nums">{count}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Recently added */}
      {recentReels.length > 0 && (
        <motion.div variants={item}>
          <h2 className="text-sm font-semibold mb-3">Recently Added</h2>
          <div className="space-y-1.5">
            {recentReels.map(r => (
              <motion.button
                key={r.id}
                onClick={() => onReelClick(r.id)}
                className="w-full flex items-center gap-3 glass rounded-lg px-3 py-2.5 hover:bg-white/[0.04] transition-colors text-left"
                whileHover={{ x: 4 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <span className="text-[10px] text-zinc-600 w-16 shrink-0 tabular-nums">
                  {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-zinc-300 truncate">{r.title || 'Untitled'}</p>
                </div>
                {r.contentCategory && r.contentCategory !== 'other' && (
                  <Badge variant="secondary" className="text-[10px] capitalize shrink-0">{r.contentCategory}</Badge>
                )}
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
