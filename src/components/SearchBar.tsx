import { useState } from 'react'
import { Search, Loader2, Sparkles, X } from 'lucide-react'
import type { Reel, SearchResult } from '../types'
import { keywordSearch, combinedSearch } from '../utils/search'

interface Props {
  reels: Reel[]
  onResults: (results: SearchResult[]) => void
}

export function SearchBar({ reels, onResults }: Props) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'keyword' | 'semantic'>('semantic')
  const [hasSearched, setHasSearched] = useState(false)

  const handleSearch = async () => {
    if (!query.trim()) { onResults([]); setHasSearched(false); return }
    setLoading(true)
    setHasSearched(true)
    try {
      if (mode === 'keyword') {
        onResults(keywordSearch(reels, query))
      } else {
        onResults(combinedSearch(reels, query))
      }
    } catch {
      onResults(keywordSearch(reels, query))
    }
    setLoading(false)
  }

  const handleClear = () => {
    setQuery('')
    onResults([])
    setHasSearched(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Search your reels..."
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-10 pr-9 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          />
          {query && (
            <button onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 shrink-0"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          <span className="hidden sm:inline">Search</span>
        </button>
      </div>

      {/* Mode toggle — clear labels */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setMode('semantic'); if (hasSearched && query.trim()) handleSearch() }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            mode === 'semantic'
              ? 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-400'
              : 'bg-zinc-800 border border-zinc-700 text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Sparkles size={12} /> AI Search
        </button>
        <button
          onClick={() => { setMode('keyword'); if (hasSearched && query.trim()) handleSearch() }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            mode === 'keyword'
              ? 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-400'
              : 'bg-zinc-800 border border-zinc-700 text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Search size={12} /> Keyword
        </button>
        {hasSearched && (
          <span className="text-[11px] text-zinc-600 ml-1">
            {mode === 'semantic' ? 'AI-powered fuzzy matching' : 'Exact word matching'}
          </span>
        )}
      </div>
    </div>
  )
}
