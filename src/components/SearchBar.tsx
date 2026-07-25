import { useState } from 'react'
import { Search, Loader2, Sparkles } from 'lucide-react'
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

  const handleSearch = async () => {
    if (!query.trim()) { onResults([]); return }
    setLoading(true)
    try {
      if (mode === 'keyword') {
        onResults(keywordSearch(reels, query))
      } else {
        // Semantic search uses TF-IDF — no API key needed
        onResults(combinedSearch(reels, query))
      }
    } catch {
      onResults(keywordSearch(reels, query))
    }
    setLoading(false)
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="Search your reels..."
          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </div>
      <button
        onClick={() => setMode(m => m === 'keyword' ? 'semantic' : 'keyword')}
        className={`px-3 py-2.5 rounded-lg text-xs font-medium border transition-colors ${
          mode === 'semantic' ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400'
        }`}
        title={`Switch to ${mode === 'semantic' ? 'keyword' : 'semantic'} search`}
      >
        <Sparkles size={14} />
      </button>
      <button
        onClick={handleSearch}
        disabled={loading || !query.trim()}
        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : 'Search'}
      </button>
    </div>
  )
}
