import { useState, useMemo } from 'react'
import { Filter, Download, BarChart3, BookOpen, Tag } from 'lucide-react'
import type { Reel, SearchResult } from '../types'
import { ReelCard } from './ReelCard'
import { SearchBar } from './SearchBar'
import { downloadCSV, downloadJSON } from '../utils/export'

interface Props {
  reels: Reel[]
  onDelete: (id: string) => void
}

export function Library({ reels, onDelete }: Props) {
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [filter, setFilter] = useState<'all' | 'complete' | 'processing'>('all')
  const [showStats, setShowStats] = useState(false)

  const displayReels = useMemo(() => {
    const base = searchResults.length > 0
      ? searchResults.map(r => r.reel)
      : reels
    if (filter === 'complete') return base.filter(r => r.ingestStatus === 'complete')
    if (filter === 'processing') return base.filter(r => r.ingestStatus !== 'complete' && r.ingestStatus !== 'failed')
    return base
  }, [reels, searchResults, filter])

  const stats = useMemo(() => ({
    total: reels.length,
    complete: reels.filter(r => r.ingestStatus === 'complete').length,
    tags: [...new Set(reels.flatMap(r => r.suggestedTags))].length,
    concepts: [...new Set(reels.flatMap(r => r.concepts?.map(c => c.conceptName) || []))].length,
  }), [reels])

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Library</h2>
          <p className="text-sm text-zinc-500">{stats.total} reels • {stats.complete} analyzed</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => downloadCSV(reels)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-white border border-zinc-700 rounded-lg transition-colors">
            <Download size={12} /> CSV
          </button>
          <button onClick={() => downloadJSON(reels)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-white border border-zinc-700 rounded-lg transition-colors">
            <Download size={12} /> JSON
          </button>
          <button onClick={() => setShowStats(!showStats)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-white border border-zinc-700 rounded-lg transition-colors">
            <BarChart3 size={12} /> Stats
          </button>
        </div>
      </div>

      {/* Stats */}
      {showStats && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total', value: stats.total, icon: BookOpen },
            { label: 'Analyzed', value: stats.complete, icon: BarChart3 },
            { label: 'Unique Tags', value: stats.tags, icon: Tag },
            { label: 'Concepts', value: stats.concepts, icon: Filter },
          ].map(s => (
            <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
                <s.icon size={12} /> {s.label}
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <SearchBar reels={reels} onResults={setSearchResults} />

      {/* Filters */}
      <div className="flex items-center gap-2">
        {(['all', 'complete', 'processing'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Results */}
      {searchResults.length > 0 && (
        <p className="text-xs text-zinc-500">{searchResults.length} results found</p>
      )}

      <div className="grid gap-3">
        {displayReels.map(reel => (
          <ReelCard key={reel.id} reel={reel} onDelete={onDelete} />
        ))}
        {displayReels.length === 0 && (
          <div className="text-center py-12 text-zinc-500">
            <BookOpen size={32} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">
              {reels.length === 0 ? 'No reels yet. Click "Add Reel" to get started.' : 'No results found.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
