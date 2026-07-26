import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { Download, BarChart3, BookOpen, Tag, XCircle, ArrowUpDown, CheckSquare, Square, Trash2, FolderPlus, RefreshCw, X, Filter } from 'lucide-react'
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

function sortReels(reels: Reel[], sort: SortKey): Reel[] {
  const sorted = [...reels]
  switch (sort) {
    case 'newest': return sorted.sort((a, b) => (b.takenAt || b.createdAt) > (a.takenAt || a.createdAt) ? 1 : -1)
    case 'oldest': return sorted.sort((a, b) => (a.takenAt || a.createdAt) > (b.takenAt || b.createdAt) ? 1 : -1)
    case 'mostEngaged': return sorted.sort((a, b) => (b.likeCount + b.commentCount + b.playCount) - (a.likeCount + a.commentCount + a.playCount))
    case 'mostViewed': return sorted.sort((a, b) => (b.viewCount || b.playCount) - (a.viewCount || a.playCount))
    case 'highestQuality': return sorted.sort((a, b) => computeQualityScore(b).overall - computeQualityScore(a).overall)
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

export function Library({ reels, onDelete, onDeleteBulk, collections, userId, onAddToCollection, highlightReelId, onClearHighlight, onReAnalyze }: Props) {
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [filters, setFilters] = useState<Filters>({ status: 'all', collection: 'all', categories: [], sentiments: [], qualityMin: 0, creator: 'all', dateRange: 'all' })
  const [sort, setSort] = useState<SortKey>('newest')
  const [showStats, setShowStats] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showSortMenu, setShowSortMenu] = useState(false)
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const reelRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Extract unique creators for filter dropdown
  const topCreators = useMemo(() => {
    const counts = new Map<string, number>()
    reels.forEach(r => { if (r.creatorHandle) counts.set(r.creatorHandle, (counts.get(r.creatorHandle) || 0) + 1) })
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([handle]) => handle)
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
      filtered = filtered.filter(r => computeQualityScore(r).overall >= filters.qualityMin)
    }

    // Creator filter
    if (filters.creator !== 'all') {
      filtered = filtered.filter(r => r.creatorHandle === filters.creator)
    }

    // Date range filter
    if (filters.dateRange !== 'all') {
      filtered = filtered.filter(r => dateInRange(r, filters.dateRange))
    }

    return sortReels(filtered, sort)
  }, [reels, searchResults, filters, sort, collections])

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
      next.has(id) ? next.delete(id) : next.add(id)
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

  const handleBulkReAnalyze = useCallback(() => {
    if (selectedIds.size === 0) return
    onReAnalyze?.([...selectedIds])
    exitSelectMode()
  }, [selectedIds, onReAnalyze, exitSelectMode])

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-3 md:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg sm:text-xl font-bold">Library</h2>
          <p className="text-xs sm:text-sm text-zinc-500">
            {displayReels.length === reels.length
              ? `${stats.total} reels · ${stats.complete} analyzed`
              : `${displayReels.length} of ${stats.total} reels`
            }
            {stats.failed > 0 && <span className="text-red-400"> · {stats.failed} failed</span>}
          </p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {selectMode ? (
            <>
              <button onClick={toggleSelectAll}
                className="flex items-center gap-1 px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs text-zinc-400 hover:text-white border border-zinc-700 rounded-lg transition-colors min-h-[36px]">
                {selectedIds.size === displayReels.length ? <XCircle size={11} /> : <CheckSquare size={11} />}
                {selectedIds.size === displayReels.length ? 'Deselect' : 'Select All'}
              </button>
              <span className="text-[11px] text-zinc-500">{selectedIds.size} selected</span>
              <button onClick={exitSelectMode}
                className="flex items-center gap-1 px-2 py-1.5 text-[11px] text-zinc-400 hover:text-white border border-zinc-700 rounded-lg transition-colors min-h-[36px]">
                <X size={11} /> Cancel
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { setSelectMode(true); setSelectedIds(new Set()) }}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs text-zinc-400 hover:text-white border border-zinc-700 rounded-lg transition-colors min-h-[36px]">
                <Square size={11} /> Select
              </button>
              <button onClick={() => downloadCSV(reels)}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs text-zinc-400 hover:text-white border border-zinc-700 rounded-lg transition-colors min-h-[36px]">
                <Download size={11} /> CSV
              </button>
              <button onClick={() => setShowStats(!showStats)}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs text-zinc-400 hover:text-white border border-zinc-700 rounded-lg transition-colors min-h-[36px]">
                <BarChart3 size={11} /> Stats
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

      {/* Filter bar — status + sort + filter toggle */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {/* Status filters */}
        {(['all', 'complete', 'processing', 'failed'] as const).map(f => (
          <button key={f} onClick={() => setFilters(prev => ({ ...prev, status: f }))}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition-colors whitespace-nowrap min-h-[32px] ${
              filters.status === f ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}

        <div className="w-px h-4 bg-zinc-700 shrink-0" />

        {/* Collection filter */}
        {collections.length > 0 && (
          <select value={filters.collection} onChange={e => setFilters(prev => ({ ...prev, collection: e.target.value }))}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-[11px] sm:text-xs text-zinc-400 focus:outline-none min-h-[32px] shrink-0">
            <option value="all">All Collections</option>
            {collections.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}

        <div className="w-px h-4 bg-zinc-700 shrink-0" />

        {/* Sort button */}
        <div className="relative">
          <button onClick={() => setShowSortMenu(!showSortMenu)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-[11px] sm:text-xs text-zinc-400 hover:text-white transition-colors whitespace-nowrap min-h-[32px]">
            <ArrowUpDown size={11} /> {SORT_OPTIONS.find(s => s.key === sort)?.label}
          </button>
          {showSortMenu && (
            <div className="absolute top-full left-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 py-1 min-w-[140px]">
              {SORT_OPTIONS.map(opt => (
                <button key={opt.key} onClick={() => { setSort(opt.key); setShowSortMenu(false) }}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors ${sort === opt.key ? 'text-indigo-400 bg-indigo-500/10' : 'text-zinc-400 hover:text-white hover:bg-zinc-700'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Advanced filter toggle */}
        <button onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition-colors whitespace-nowrap min-h-[32px] border ${
            activeFilterCount > 0 ? 'bg-indigo-600/20 border-indigo-500/30 text-indigo-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'
          }`}>
          <Filter size={11} /> Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
        </button>
      </div>

      {/* Advanced filters panel */}
      {showFilters && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-medium text-zinc-400">Advanced Filters</h4>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="text-[11px] text-indigo-400 hover:text-indigo-300">Clear all</button>
            )}
          </div>

          {/* Content Category */}
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Content Type</p>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_OPTIONS.map(cat => (
                <button key={cat} onClick={() => toggleFilterArray('categories', cat)}
                  className={`px-2 py-1 rounded text-[11px] transition-colors min-h-[28px] ${
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
                  className={`px-2 py-1 rounded text-[11px] transition-colors min-h-[28px] ${
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
                  className={`px-2 py-1 rounded text-[11px] transition-colors min-h-[28px] ${
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
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-[11px] sm:text-xs text-zinc-400 focus:outline-none min-h-[32px] w-full sm:w-auto">
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
                  className={`px-2 py-1 rounded text-[11px] transition-colors min-h-[28px] ${
                    filters.dateRange === d.key ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                  }`}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Results count */}
      {(searchResults.length > 0 || displayReels.length !== reels.length) && (
        <p className="text-[11px] text-zinc-500">{displayReels.length} results found</p>
      )}

      {/* Bulk action bar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-50 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl px-3 py-2 flex items-center gap-2">
          <button onClick={handleBulkDelete}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-xs font-medium transition-colors min-h-[36px]">
            <Trash2 size={12} /> Delete
          </button>
          <button onClick={handleBulkReAnalyze}
            className="flex items-center gap-1.5 px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 rounded-lg text-xs font-medium transition-colors min-h-[36px]">
            <RefreshCw size={12} /> Re-analyze
          </button>
          <button onClick={() => {
            const colId = prompt('Enter collection name to add to (or use existing):')
            if (colId) {
              selectedIds.forEach(id => {
                const col = collections.find(c => c.name.toLowerCase() === colId.toLowerCase())
                if (col) onAddToCollection(id, col.id)
              })
            }
          }}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 rounded-lg text-xs font-medium transition-colors min-h-[36px]">
            <FolderPlus size={12} /> Collection
          </button>
        </div>
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
    </div>
  )
}
