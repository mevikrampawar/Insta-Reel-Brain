import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { Download, BarChart3, BookOpen, Tag, XCircle, CheckSquare, Square, Trash2, FolderPlus, RefreshCw, X, Filter, Zap, AlertTriangle } from 'lucide-react'
import type { Reel, Collection, SearchResult } from '../types'
import { ReelCard } from './ReelCard'
import { SearchBar } from './SearchBar'
import { downloadCSV } from '../utils/export'
import { computeQualityScore } from '../utils/quality'

interface Props {
  reels: Reel[]
  onDelete: (id: string) => void
  onDeleteBulk?: (ids: string[]) => void
  collections: Collection[]
  userId: string
  onAddToCollection: (reelId: string, collectionId: string) => void
  highlightReelId?: string
  onClearHighlight?: () => void
  onReAnalyze?: (ids: string[]) => void
  onReScrape?: (id: string) => void
  libraryFilters?: { categories?: string[]; creator?: string }
  onBatchReAnalyze?: (ids: string[]) => void
  onBatchReScrape?: (ids: string[]) => void
}

type SortKey = 'newest' | 'oldest' | 'mostEngaged' | 'mostViewed' | 'highestQuality' | 'mostTalked'
type DateRange = 'all' | 'week' | 'month' | 'year'

interface Filters {
  status: 'all' | 'complete' | 'processing' | 'failed'
  collection: string
  categories: string[]
  sentiments: string[]
  qualityMin: number
  creator: string
  dateRange: DateRange
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'mostEngaged', label: 'Most Engaged' },
  { key: 'mostViewed', label: 'Most Viewed' },
  { key: 'highestQuality', label: 'Highest Quality' },
  { key: 'mostTalked', label: 'Most Discussed' },
]

const CATEGORY_OPTIONS = ['educational', 'entertainment', 'motivational', 'instructional', 'review', 'storytelling', 'news', 'other']
const SENTIMENT_OPTIONS = ['positive', 'negative', 'neutral', 'mixed']
const QUALITY_RANGES = [
  { label: 'All', min: 0 },
  { label: 'Excellent', min: 80 },
  { label: 'Good', min: 60 },
  { label: 'Average', min: 40 },
]
const DATE_RANGES: { key: DateRange; label: string }[] = [
  { key: 'all', label: 'All Time' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'This Year' },
]

function sortReels(reels: Reel[], sort: SortKey, qualityScores: Map<string, number>): Reel[] {
  const sorted = [...reels]
  switch (sort) {
    case 'newest': return sorted.sort((a, b) => (b.takenAt || b.createdAt) > (a.takenAt || a.createdAt) ? 1 : -1)
    case 'oldest': return sorted.sort((a, b) => (a.takenAt || a.createdAt) > (b.takenAt || b.createdAt) ? 1 : -1)
    case 'mostEngaged': return sorted.sort((a, b) => (b.likeCount + b.commentCount + b.playCount) - (a.likeCount + a.commentCount + a.playCount))
    case 'mostViewed': return sorted.sort((a, b) => (b.viewCount || b.playCount) - (a.viewCount || a.playCount))
    case 'highestQuality': return sorted.sort((a, b) => (qualityScores.get(b.id) ?? 0) - (qualityScores.get(a.id) ?? 0))
    case 'mostTalked': return sorted.sort((a, b) => b.commentCount - a.commentCount)
    default: return sorted
  }
}

function dateInRange(reel: Reel, range: DateRange): boolean {
  if (range === 'all') return true
  const ts = reel.takenAt || reel.createdAt
  if (!ts) return true
  const d = typeof ts === 'string' ? new Date(ts).getTime() : ts
  const now = Date.now()
  const ms = range === 'week' ? 7 * 86400000 : range === 'month' ? 30 * 86400000 : 365 * 86400000
  return d >= now - ms
}

export function Library({ reels, onDelete, onDeleteBulk, collections, userId, onAddToCollection, highlightReelId, onClearHighlight, onReAnalyze, onReScrape, libraryFilters, onBatchReAnalyze, onBatchReScrape }: Props) {
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [filters, setFilters] = useState<Filters>({ status: 'all', collection: 'all', categories: [], sentiments: [], qualityMin: 0, creator: 'all', dateRange: 'all' })
  const [sort, setSort] = useState<SortKey>('newest')
  const [showStats, setShowStats] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBatchConfirm, setShowBatchConfirm] = useState<'analyze' | 'scrape' | null>(null)
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const reelRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  useEffect(() => {
    if (!libraryFilters) return
    setFilters(prev => ({
      ...prev,
      categories: libraryFilters.categories || prev.categories,
      creator: libraryFilters.creator || prev.creator,
    }))
  }, [libraryFilters])

  // Extract unique creators for filter dropdown
  const topCreators = useMemo(() => {
    const counts = new Map<string, number>()
    reels.forEach(r => { if (r.creatorHandle) counts.set(r.creatorHandle, (counts.get(r.creatorHandle) || 0) + 1) })
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([handle]) => handle)
  }, [reels])

  const qualityScores = useMemo(() => {
    const map = new Map<string, number>()
    for (const reel of reels) map.set(reel.id, computeQualityScore(reel).overall)
    return map
  }, [reels])

  const displayReels = useMemo(() => {
    const base = searchResults.length > 0 ? searchResults.map(r => r.reel) : reels
    let filtered = base

    // Status filter
    if (filters.status === 'complete') filtered = filtered.filter(r => r.ingestStatus === 'complete')
    else if (filters.status === 'processing') filtered = filtered.filter(r => !['complete', 'failed'].includes(r.ingestStatus))
    else if (filters.status === 'failed') filtered = filtered.filter(r => r.ingestStatus === 'failed')

    // Collection filter
    if (filters.collection !== 'all') {
      const col = collections.find(c => c.id === filters.collection)
      if (col) filtered = filtered.filter(r => col.reelIds?.includes(r.id))
    }

    // Category filter
    if (filters.categories.length > 0) {
      filtered = filtered.filter(r => filters.categories.includes(r.contentCategory || 'other'))
    }

    // Sentiment filter
    if (filters.sentiments.length > 0) {
      filtered = filtered.filter(r => filters.sentiments.includes(r.sentiment || 'neutral'))
    }

    // Quality filter
    if (filters.qualityMin > 0) {
      filtered = filtered.filter(r => (qualityScores.get(r.id) ?? 0) >= filters.qualityMin)
    }

    // Creator filter
    if (filters.creator !== 'all') {
      filtered = filtered.filter(r => r.creatorHandle === filters.creator)
    }

    // Date range filter
    if (filters.dateRange !== 'all') {
      filtered = filtered.filter(r => dateInRange(r, filters.dateRange))
    }

    return sortReels(filtered, sort, qualityScores)
  }, [reels, searchResults, filters, sort, collections, qualityScores])

  const stats = useMemo(() => ({
    total: reels.length,
    complete: reels.filter(r => r.ingestStatus === 'complete').length,
    failed: reels.filter(r => r.ingestStatus === 'failed').length,
    tags: [...new Set(reels.flatMap(r => r.suggestedTags))].length,
    concepts: [...new Set(reels.flatMap(r => r.concepts?.map(c => c.conceptName) || []))].length,
    entities: [...new Set(reels.flatMap(r => r.entities?.map(e => e.name) || []))].length,
  }), [reels])

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.status !== 'all') count++
    if (filters.collection !== 'all') count++
    if (filters.categories.length > 0) count++
    if (filters.sentiments.length > 0) count++
    if (filters.qualityMin > 0) count++
    if (filters.creator !== 'all') count++
    if (filters.dateRange !== 'all') count++
    return count
  }, [filters])

  const clearFilters = useCallback(() => {
    setFilters({ status: 'all', collection: 'all', categories: [], sentiments: [], qualityMin: 0, creator: 'all', dateRange: 'all' })
  }, [])

  const clearAll = useCallback(() => {
    clearFilters()
    setSort('newest')
  }, [clearFilters])

  const toggleFilterArray = useCallback((key: 'categories' | 'sentiments', value: string) => {
    setFilters(prev => {
      const arr = prev[key]
      const next = arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]
      return { ...prev, [key]: next }
    })
  }, [])

  // Highlight logic
  useEffect(() => {
    if (!highlightReelId) return
    const timer = setTimeout(() => {
      const el = reelRefs.current.get(highlightReelId)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      highlightTimerRef.current = setTimeout(() => onClearHighlight?.(), 3000)
    }, 100)
    return () => { clearTimeout(timer); clearTimeout(highlightTimerRef.current) }
  }, [highlightReelId, onClearHighlight])

  // Selection logic
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === displayReels.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(displayReels.map(r => r.id)))
    }
  }, [displayReels, selectedIds.size])

  const exitSelectMode = useCallback(() => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }, [])

  // Bulk actions
  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size === 0) return
    if (confirm(`Delete ${selectedIds.size} reel(s)?`)) {
      onDeleteBulk?.([...selectedIds])
      exitSelectMode()
    }
  }, [selectedIds, onDeleteBulk, exitSelectMode])

  const handleBatchAction = useCallback((type: 'analyze' | 'scrape') => {
    if (selectedIds.size === 0) return
    setShowBatchConfirm(type)
  }, [selectedIds])

  const confirmBatch = useCallback(() => {
    if (!showBatchConfirm) return
    const ids = [...selectedIds]
    if (showBatchConfirm === 'analyze') {
      onBatchReAnalyze?.(ids)
    } else {
      onBatchReScrape?.(ids)
    }
    setShowBatchConfirm(null)
    exitSelectMode()
  }, [showBatchConfirm, selectedIds, onBatchReAnalyze, onBatchReScrape, exitSelectMode])

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-3 md:space-y-4 max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-bold">Library</h2>
          <p className="text-[11px] sm:text-sm text-zinc-500 truncate">
            {displayReels.length === reels.length
              ? `${stats.total} reels · ${stats.complete} analyzed`
              : `${displayReels.length} of ${stats.total} reels`
            }
            {stats.failed > 0 && <span className="text-red-400"> · {stats.failed} failed</span>}
          </p>
        </div>
        <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-end shrink-0">
          {selectMode ? (
            <>
              <button onClick={toggleSelectAll}
                className="flex items-center gap-1 px-2 sm:px-3 py-2 text-[11px] sm:text-xs text-zinc-400 hover:text-white border border-zinc-700 rounded-xl transition-colors min-h-[36px] sm:min-h-[40px]">
                {selectedIds.size === displayReels.length ? <XCircle size={12} /> : <CheckSquare size={12} />}
                <span className="hidden sm:inline">{selectedIds.size === displayReels.length ? 'Deselect' : 'Select All'}</span>
              </button>
              <span className="text-[10px] sm:text-[11px] text-zinc-500 tabular-nums">{selectedIds.size}</span>
              {selectedIds.size > 0 && (
                <>
                  <div className="w-px h-3.5 bg-zinc-700 shrink-0" />
                  <button onClick={handleBulkDelete}
                    className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                    title="Delete selected">
                    <Trash2 size={13} />
                  </button>
                  <button onClick={() => handleBatchAction('analyze')}
                    className="p-2 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-xl transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                    title="Re-analyze selected">
                    <RefreshCw size={13} />
                  </button>
                  {onBatchReScrape && (
                    <button onClick={() => handleBatchAction('scrape')}
                      className="p-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-xl transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                      title="Re-scrape selected">
                      <Zap size={13} />
                    </button>
                  )}
                  <button onClick={() => {
                    const colId = prompt('Enter collection name to add to (or use existing):')
                    if (colId) {
                      selectedIds.forEach(id => {
                        const col = collections.find(c => c.name.toLowerCase() === colId.toLowerCase())
                        if (col) onAddToCollection(id, col.id)
                      })
                    }
                  }}
                    className="p-2 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-xl transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                    title="Add to collection">
                    <FolderPlus size={13} />
                  </button>
                </>
              )}
              <button onClick={exitSelectMode}
                className="p-2 text-zinc-400 hover:text-white border border-zinc-700 rounded-xl transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                title="Cancel selection">
                <X size={13} />
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { setSelectMode(true); setSelectedIds(new Set()) }}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 text-[11px] sm:text-xs text-zinc-400 hover:text-white border border-zinc-700 rounded-xl transition-colors min-h-[36px] sm:min-h-[40px]">
                <Square size={12} /> <span className="hidden sm:inline">Select</span>
              </button>
              <button onClick={() => downloadCSV(reels)}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 text-[11px] sm:text-xs text-zinc-400 hover:text-white border border-zinc-700 rounded-xl transition-colors min-h-[36px] sm:min-h-[40px]">
                <Download size={12} /> <span className="hidden sm:inline">CSV</span>
              </button>
              <button onClick={() => setShowStats(!showStats)}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 text-[11px] sm:text-xs text-zinc-400 hover:text-white border border-zinc-700 rounded-xl transition-colors min-h-[36px] sm:min-h-[40px]">
                <BarChart3 size={12} /> <span className="hidden sm:inline">Stats</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      {showStats && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
          {[
            { label: 'Total', value: stats.total, icon: BookOpen },
            { label: 'Analyzed', value: stats.complete, icon: BarChart3 },
            { label: 'Failed', value: stats.failed, icon: XCircle },
            { label: 'Tags', value: stats.tags, icon: Tag },
            { label: 'Concepts', value: stats.concepts, icon: Tag },
            { label: 'Entities', value: stats.entities, icon: Tag },
          ].map(s => (
            <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 sm:p-3">
              <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] sm:text-xs mb-0.5 sm:mb-1">
                <s.icon size={10} /> {s.label}
              </div>
              <p className="text-lg sm:text-2xl font-bold">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <SearchBar reels={reels} onResults={setSearchResults} />

      {/* Toolbar — single Filters affordance (progressive disclosure) */}
      <div className="flex items-center gap-2">
        <button onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors min-h-[40px] border ${
            showFilters || activeFilterCount > 0 ? 'bg-indigo-600/20 border-indigo-500/30 text-indigo-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'
          }`}>
          <Filter size={12} /> Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
        </button>
        {(activeFilterCount > 0 || sort !== 'newest') && (
          <button onClick={clearAll}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs text-zinc-400 hover:text-white transition-colors min-h-[40px]">
            <X size={12} /> Reset
          </button>
        )}
        {sort !== 'newest' && (
          <span className="text-[11px] text-zinc-600 ml-auto">Sorted: {SORT_OPTIONS.find(s => s.key === sort)?.label}</span>
        )}
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-medium text-zinc-400">Refine</h4>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="text-[11px] text-indigo-400 hover:text-indigo-300">Clear all</button>
            )}
          </div>

          {/* Sort */}
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Sort by</p>
            <div className="flex flex-wrap gap-1.5">
              {SORT_OPTIONS.map(opt => (
                <button key={opt.key} onClick={() => setSort(opt.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors min-h-[36px] ${
                    sort === opt.key ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Status</p>
            <div className="flex flex-wrap gap-1.5">
              {(['all', 'complete', 'processing', 'failed'] as const).map(f => (
                <button key={f} onClick={() => setFilters(prev => ({ ...prev, status: f }))}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors min-h-[36px] ${
                    filters.status === f ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                  }`}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Collection */}
          {collections.length > 0 && (
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Collection</p>
              <select value={filters.collection} onChange={e => setFilters(prev => ({ ...prev, collection: e.target.value }))}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-400 focus:outline-none min-h-[36px] w-full">
                <option value="all">All Collections</option>
                {collections.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="border-t border-zinc-800 pt-3 space-y-3">
          {/* Content Category */}
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Content Type</p>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_OPTIONS.map(cat => (
                <button key={cat} onClick={() => toggleFilterArray('categories', cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors min-h-[36px] ${
                    filters.categories.includes(cat) ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                  }`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Sentiment */}
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Sentiment</p>
            <div className="flex flex-wrap gap-1.5">
              {SENTIMENT_OPTIONS.map(s => (
                <button key={s} onClick={() => toggleFilterArray('sentiments', s)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors min-h-[36px] ${
                    filters.sentiments.includes(s) ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Quality */}
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Quality Score</p>
            <div className="flex flex-wrap gap-1.5">
              {QUALITY_RANGES.map(q => (
                <button key={q.label} onClick={() => setFilters(prev => ({ ...prev, qualityMin: q.min }))}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors min-h-[36px] ${
                    filters.qualityMin === q.min ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                  }`}>
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          {/* Creator */}
          {topCreators.length > 0 && (
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Creator</p>
              <select value={filters.creator} onChange={e => setFilters(prev => ({ ...prev, creator: e.target.value }))}
                className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-400 focus:outline-none min-h-[40px] w-full sm:w-auto">
                <option value="all">All Creators</option>
                {topCreators.map(h => (
                  <option key={h} value={h}>@{h}</option>
                ))}
              </select>
            </div>
          )}

          {/* Date Range */}
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Date Range</p>
            <div className="flex flex-wrap gap-1.5">
              {DATE_RANGES.map(d => (
                <button key={d.key} onClick={() => setFilters(prev => ({ ...prev, dateRange: d.key }))}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors min-h-[36px] ${
                    filters.dateRange === d.key ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                  }`}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          </div>
        </div>
      )}

      {/* Results count */}
      {(searchResults.length > 0 || displayReels.length !== reels.length) && (
        <p className="text-[11px] text-zinc-500">{displayReels.length} results found</p>
      )}

      {/* Reel grid — responsive columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
        {displayReels.map(reel => (
          <div
            key={reel.id}
            ref={el => { if (el) reelRefs.current.set(reel.id, el) }}
            className={`relative transition-all duration-500 ${
              highlightReelId === reel.id ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-zinc-950 rounded-xl' : ''
            }`}
          >
            {/* Selection checkbox overlay */}
            {selectMode && (
              <button onClick={() => toggleSelect(reel.id)}
                className={`absolute top-2 left-2 z-10 w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                  selectedIds.has(reel.id) ? 'bg-indigo-600 text-white' : 'bg-zinc-800/80 text-zinc-400 border border-zinc-600'
                }`}>
                {selectedIds.has(reel.id) && <CheckSquare size={14} />}
              </button>
            )}
            <ReelCard
              reel={reel}
              userId={userId}
              onDelete={onDelete}
              collections={collections}
              onAddToCollection={onAddToCollection}
              onReAnalyze={onReAnalyze ? () => onReAnalyze([reel.id]) : undefined}
              onReScrape={onReScrape}
            />
          </div>
        ))}
        {displayReels.length === 0 && (
          <div className="col-span-full text-center py-12 sm:py-16 text-zinc-500">
            <BookOpen size={28} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">
              {reels.length === 0 ? 'No reels yet.' : 'No results found.'}
            </p>
            {reels.length === 0 && (
              <p className="text-xs mt-1 text-zinc-600">Tap "Add" to paste your first Instagram Reel URL.</p>
            )}
            {reels.length > 0 && activeFilterCount > 0 && (
              <button onClick={clearFilters} className="text-xs mt-2 text-indigo-400 hover:text-indigo-300">Clear filters</button>
            )}
          </div>
        )}
      </div>

      {/* Batch confirmation dialog */}
      {showBatchConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setShowBatchConfirm(null)}>
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl p-5"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${showBatchConfirm === 'analyze' ? 'bg-purple-500/10' : 'bg-emerald-500/10'}`}>
                {showBatchConfirm === 'analyze' ? <RefreshCw size={18} className="text-purple-400" /> : <Zap size={18} className="text-emerald-400" />}
              </div>
              <div>
                <h3 className="text-sm font-semibold">
                  {showBatchConfirm === 'analyze' ? 'Re-analyze Reels' : 'Re-scrape Reels'}
                </h3>
                <p className="text-[11px] text-zinc-500">
                  {selectedIds.size} selected reel{selectedIds.size !== 1 ? 's' : ''} will be processed
                </p>
              </div>
            </div>
            <div className="px-3 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-4 flex items-start gap-2">
              <AlertTriangle size={12} className="text-amber-400 mt-0.5 shrink-0" />
              <p className="text-[10px] text-amber-300/80 leading-relaxed">
                {showBatchConfirm === 'analyze'
                  ? `Rate limited to ~7 reels/min (Groq free tier). ${selectedIds.size} reels will take ~${Math.ceil(selectedIds.size / 7)} min.`
                  : `Re-scraping is serialized (~1 at a time). ${selectedIds.size} reels will take several minutes.`
                } Single reel actions are not affected.
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowBatchConfirm(null)}
                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-medium transition-colors">
                Cancel
              </button>
              <button onClick={confirmBatch}
                className={`flex-1 py-2.5 rounded-xl text-xs font-medium text-white transition-colors ${
                  showBatchConfirm === 'analyze' ? 'bg-purple-600 hover:bg-purple-500' : 'bg-emerald-600 hover:bg-emerald-500'
                }`}>
                {showBatchConfirm === 'analyze' ? 'Start Re-analyzing' : 'Start Re-scraping'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
