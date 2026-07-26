import { useState } from 'react'
import { Plus, FolderOpen, Trash2, ChevronRight, X, Tag, ArrowRight, RefreshCw, Loader2 } from 'lucide-react'
import type { Collection, Reel } from '../types'

interface Props {
  collections: Collection[]
  reels: Reel[]
  onAdd: (data: Partial<Collection>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onReelClick?: (reelId: string) => void
  onRetroactiveAutoAssign?: () => Promise<{ processed: number; assigned: number }>
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#8b5cf6']

export function Collections({ collections, reels, onAdd, onDelete, onReelClick, onRetroactiveAutoAssign }: Props) {
  const [showNew, setShowNew] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [retroRunning, setRetroRunning] = useState(false)
  const [retroResult, setRetroResult] = useState<{ processed: number; assigned: number } | null>(null)

  const handleCreate = async () => {
    if (!name.trim()) return
    try {
      await onAdd({ name: name.trim(), description: desc.trim(), color })
    } finally {
      setName(''); setDesc(''); setShowNew(false)
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Collections</h2>
          <p className="text-sm text-zinc-500">{collections.length} collections</p>
        </div>
        <div className="flex items-center gap-2">
          {onRetroactiveAutoAssign && reels.length > 0 && (
            <button
              onClick={async () => {
                setRetroRunning(true)
                setRetroResult(null)
                try {
                  const result = await onRetroactiveAutoAssign()
                  setRetroResult(result)
                } catch {
                  setRetroResult({ processed: 0, assigned: 0 })
                }
                setRetroRunning(false)
              }}
              disabled={retroRunning}
              className="flex items-center gap-1.5 px-3 min-h-[44px] bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
            >
              {retroRunning ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Auto-Assign All
            </button>
          )}
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-3 min-h-[44px] bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors">
            <Plus size={14} /> New
          </button>
        </div>
      </div>

      {retroResult && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-xs text-emerald-400">
          Processed {retroResult.processed} reels, assigned to {retroResult.assigned} collections
        </div>
      )}

      {/* New collection form */}
      {showNew && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm">New Collection</h3>
            <button onClick={() => setShowNew(false)} className="min-w-[36px] min-h-[36px] flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"><X size={16} /></button>
          </div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Collection name"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 min-h-[48px] text-sm focus:outline-none focus:border-indigo-500" autoFocus />
          <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 min-h-[48px] text-sm focus:outline-none focus:border-indigo-500" />
          <div className="flex items-center gap-2 flex-wrap">
            {COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)}
                className={`min-w-[36px] min-h-[36px] rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-white' : ''}`}
                style={{ background: c }} />
            ))}
          </div>
          <button onClick={handleCreate} disabled={!name.trim()}
            className="w-full min-h-[48px] bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors">
            Create
          </button>
        </div>
      )}

      {/* Collection list */}
      <div className="space-y-2">
        {collections.map(c => {
          const reelCount = c.reelIds?.length || 0
          const isExpanded = expandedId === c.id
          const collectionReels = reels.filter(r => c.reelIds?.includes(r.id))

          return (
            <div key={c.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 p-4 min-h-[56px] cursor-pointer hover:bg-zinc-800/50 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : c.id)}>
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: c.color }} />
                <FolderOpen size={16} className="text-zinc-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{c.name}</p>
                  {c.description && <p className="text-xs text-zinc-500 truncate">{c.description}</p>}
                </div>
                <span className="text-xs text-zinc-500 shrink-0">{reelCount} reels</span>
                <ChevronRight size={14} className={`text-zinc-500 transition-transform shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
                <button onClick={(e) => { e.stopPropagation(); onDelete(c.id) }}
                  className="min-w-[36px] min-h-[36px] flex items-center justify-center text-zinc-600 hover:text-red-400 transition-colors shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
              {isExpanded && collectionReels.length > 0 && (
                <div className="border-t border-zinc-800 p-3 space-y-1">
                  {collectionReels.map(r => (
                    <button
                      key={r.id}
                      onClick={() => onReelClick?.(r.id)}
                      className="w-full flex items-center gap-2 px-3 min-h-[40px] rounded-lg text-xs hover:bg-zinc-800/50 transition-colors text-left group"
                    >
                      <Tag size={10} className="text-zinc-500 shrink-0" />
                      <span className="truncate flex-1 text-zinc-300 group-hover:text-white transition-colors">{r.title || 'Untitled'}</span>
                      <span className="text-zinc-600 shrink-0">@{r.creatorHandle}</span>
                      <ArrowRight size={10} className="text-zinc-600 group-hover:text-indigo-400 shrink-0 opacity-0 group-hover:opacity-100 transition-all" />
                    </button>
                  ))}
                </div>
              )}
              {isExpanded && collectionReels.length === 0 && (
                <div className="border-t border-zinc-800 p-4 text-center text-xs text-zinc-500">
                  No reels in this collection yet.
                </div>
              )}
            </div>
          )
        })}
        {collections.length === 0 && (
          <div className="text-center py-12 text-zinc-500">
            <FolderOpen size={32} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">No collections yet.</p>
            <p className="text-xs mt-1 text-zinc-600">Create one to organize your Reels.</p>
          </div>
        )}
      </div>
    </div>
  )
}
