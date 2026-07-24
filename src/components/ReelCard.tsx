import { useState } from 'react'
import { ExternalLink, Tag, Clock, Trash2, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'
import type { Reel } from '../types'

interface Props {
  reel: Reel
  onDelete: (id: string) => void
}

export function ReelCard({ reel, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (reel.ingestStatus === 'failed') {
    return (
      <div className="bg-zinc-900 border border-red-500/30 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle size={16} />
            <span className="text-sm font-medium">Failed: {reel.title || reel.url}</span>
          </div>
          <button onClick={() => onDelete(reel.id)} className="text-zinc-500 hover:text-red-400 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
        <p className="text-xs text-zinc-500 mt-1">{reel.errorMessage}</p>
      </div>
    )
  }

  if (reel.ingestStatus !== 'complete') {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 animate-pulse">
        <div className="flex items-center gap-2 text-zinc-400">
          <div className="w-4 h-4 rounded-full bg-indigo-500/30" />
          <span className="text-sm">Processing: {reel.title || reel.url}...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition-colors">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium text-sm truncate">{reel.title}</h3>
              {reel.url && reel.url !== 'manual-entry' && (
                <a href={reel.url} target="_blank" rel="noopener noreferrer"
                  className="text-zinc-500 hover:text-indigo-400 shrink-0 transition-colors">
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
            {reel.creatorHandle && <p className="text-xs text-zinc-500 mb-2">@{reel.creatorHandle}</p>}
            <p className="text-sm text-zinc-300 line-clamp-2">{reel.summary}</p>
          </div>
          <button onClick={() => onDelete(reel.id)} className="text-zinc-600 hover:text-red-400 shrink-0 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>

        {/* Tags */}
        {reel.suggestedTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {reel.suggestedTags.slice(0, 5).map(tag => (
              <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded text-xs">
                <Tag size={10} /> {tag}
              </span>
            ))}
          </div>
        )}

        {/* Concepts */}
        {reel.concepts?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {reel.concepts.slice(0, 4).map(c => (
              <span key={c.conceptName} className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-xs capitalize">
                {c.conceptType}: {c.conceptName}
              </span>
            ))}
          </div>
        )}

        {/* Expand */}
        <button onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 mt-3 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {expanded ? 'Less' : 'More'}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-zinc-800 p-4 space-y-3 text-sm">
          {/* Takeaways */}
          {reel.keyTakeaways.length > 0 && (
            <div>
              <p className="text-xs font-medium text-zinc-400 mb-1">Key Takeaways</p>
              <ul className="space-y-1">
                {reel.keyTakeaways.map((t, i) => (
                  <li key={i} className="text-zinc-300 text-xs flex gap-2">
                    <span className="text-indigo-400">•</span> {t}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Transcript */}
          {reel.transcript && (
            <div>
              <p className="text-xs font-medium text-zinc-400 mb-1">Transcript</p>
              <p className="text-zinc-300 text-xs leading-relaxed whitespace-pre-wrap">{reel.transcript}</p>
            </div>
          )}

          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <Clock size={12} />
            {new Date(reel.createdAt).toLocaleDateString()}
          </div>
        </div>
      )}
    </div>
  )
}
