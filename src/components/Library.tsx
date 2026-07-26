import { useState, useMemo, useEffect, useRef } from 'react'
import { Download, BarChart3, BookOpen, Tag, XCircle } from 'lucide-react'
import type { Reel, Collection, SearchResult } from '../types'
import { ReelCard } from './ReelCard'
import { SearchBar } from './SearchBar'
import { downloadCSV, downloadJSON } from '../utils/export'

interface Props {
  reels: Reel[]
  onDelete: (id: string) => void
  collections: Collection[]
  userId: string
  onAddToCollection: (reelId: string, collectionId: string) => void
  highlightReelId?: string
  onClearHighlight?: () => void
}

export function Library({ reels, onDelete, collections, userId, onAddToCollection, highlightReelId, onClearHighlight }: Props) {
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [filter, setFilter] = useState<'all' | 'complete' | 'processing' | 'failed'>('all')
  const [collectionFilter, setCollectionFilter] = useState<string>('all')
  const [showStats, setShowStats] = useState(false)
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const reelRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const displayReels = useMemo(() => {
    const base = searchResults.length > 0 ? searchResults.map(r => r.reel) : reels
    let filtered = base
    if (filter === 'complete') filtered = filtered.filter(r => r.ingestStatus === 'complete')
    else if (filter === 'processing') filtered = filtered.filter(r => !['complete', 'failed'].includes(r.ingestStatus))
    else if (filter === 'failed') filtered = filtered.filter(r => r.ingestStatus === 'failed')
    if (collectionFilter !== 'all') {
      const col = collections.find(c => c.id === collectionFilter)
      if (col) filtered = filtered.filter(r => col.reelIds?.includes(r.id))
    }
    return filtered
  }, [reels, searchResults, filter, collectionFilter, collections])

  const stats = useMemo(() => ({
    total: reels.length,
    complete: reels.filter(r => r.ingestStatus === 'complete').length,
    failed: reels.filter(r => r.ingestStatus === 'failed').length,
    tags: [...new Set(reels.flatMap(r => r.suggestedTags))].length,
    concepts: [...new Set(reels.flatMap(r => r.concepts?.map(c => c.conceptName) || []))].length,
  }), [reels])

  useEffect(() => {
    if (!highlightReelId) return
    const timer = setTimeout(() => {
      const el = reelRefs.current.get(highlightReelId)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      highlightTimerRef.current = setTimeout(() => onClearHighlight?.(), 3000)
    }, 100)
    return () => { clearTimeout(timer); clearTimeout(highlightTimerRef.current) }
  }, [highlightReelId, onClearHighlight])

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-3 md:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg sm:text-xl font-bold">Library</h2>
          <p className="text-xs sm:text-sm text-zinc-500">
            {stats.total} reels · {stats.complete} analyzed
            {stats.failed > 0 && <span className="text-red-400"> · {stats.failed} failed</span>}
          </p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button onClick={() => downloadCSV(reels)}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-1.5 text-[11px] sm:text-xs text-zinc-400 hover:text-white border border-zinc-700 rounded-lg transition-colors min-h-[36px]">
            <Download size={11} /> CSV
          </button>
          <button onClick={() => downloadJSON(reels)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-white border border-zinc-700 rounded-lg transition-colors">
            <Download size={12} /> JSON
          </button>
          <button onClick={() => setShowStats(!showStats)}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-1.5 text-[11px] sm:text-xs text-zinc-400 hover:text-white border border-zinc-700 rounded-lg transition-colors min-h-[36px]">
            <BarChart3 size={11} /> Stats
          </button>
        </div>
      </div>

      {/* Stats */}
      {showStats && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
          {[
            { label: 'Total', value: stats.total, icon: BookOpen },
            { label: 'Analyzed', value: stats.complete, icon: BarChart3 },
            { label: 'Failed', value: stats.failed, icon: XCircle },
            { label: 'Tags', value: stats.tags, icon: Tag },
            { label: 'Concepts', value: stats.concepts, icon: Tag },
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

      {/* Filters — horizontal scroll on mobile */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {(['all', 'complete', 'processing', 'failed'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition-colors whitespace-nowrap min-h-[32px] ${
              filter === f ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        {collections.length > 0 && (
          <>
            <div className="w-px h-4 bg-zinc-700 shrink-0" />
            <select value={collectionFilter} onChange={e => setCollectionFilter(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-[11px] sm:text-xs text-zinc-400 focus:outline-none min-h-[32px] shrink-0">
              <option value="all">All Collections</option>
              {collections.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </>
        )}
      </div>

      {/* Results count */}
      {searchResults.length > 0 && (
        <p className="text-[11px] text-zinc-500">{searchResults.length} results found</p>
      )}

      {/* Reel list */}
      <div className="grid gap-2.5 sm:gap-3">
        {displayReels.map(reel => (
          <div
            key={reel.id}
            ref={el => { if (el) reelRefs.current.set(reel.id, el) }}
            className={`transition-all duration-500 ${highlightReelId === reel.id ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-zinc-950 rounded-xl' : ''}`}
          >
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
          <div className="text-center py-12 sm:py-16 text-zinc-500">
            <BookOpen size={28} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">
              {reels.length === 0 ? 'No reels yet.' : 'No results found.'}
            </p>
            {reels.length === 0 && (
              <p className="text-xs mt-1 text-zinc-600">Tap "Add" to paste your first Instagram Reel URL.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
