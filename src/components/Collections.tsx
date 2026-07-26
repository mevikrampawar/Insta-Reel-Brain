import { useState } from 'react'
import { Plus, FolderOpen, Trash2, ChevronRight, X, Tag, ArrowRight, RefreshCw, Loader2, Pencil, GitMerge, GripVertical } from 'lucide-react'
import type { Collection, Reel } from '../types'

interface Props {
  collections: Collection[]
  reels: Reel[]
  onAdd: (data: Partial<Collection>) => Promise<void>
  onDelete: (id: string, keepReels?: boolean) => Promise<void>
  onRename: (id: string, newName: string) => Promise<void>
  onMerge: (sourceId: string, targetId: string) => Promise<void>
  onAddReel: (collectionId: string, reelId: string) => Promise<void>
  onRemoveReel: (collectionId: string, reelId: string) => Promise<void>
  onReelClick?: (reelId: string) => void
  onRetroactiveAutoAssign?: () => Promise<{ processed: number; assigned: number }>
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#8b5cf6']

export function Collections({ collections, reels, onAdd, onDelete, onRename, onMerge, onAddReel, onRemoveReel, onReelClick, onRetroactiveAutoAssign }: Props) {
  const [showNew, setShowNew] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [mergeSource, setMergeSource] = useState<string | null>(null)
  const [mergeTarget, setMergeTarget] = useState<string | null>(null)
  const [showMergePanel, setShowMergePanel] = useState(false)
  const [retroRunning, setRetroRunning] = useState(false)
  const [retroResult, setRetroResult] = useState<{ processed: number; assigned: number } | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [showAddReelPanel, setShowAddReelPanel] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!name.trim()) return
    try {
      await onAdd({ name: name.trim(), description: desc.trim(), color })
    } finally {
      setName(''); setDesc(''); setShowNew(false)
    }
  }

  const handleRename = async (id: string) => {
    if (!editName.trim()) return
    await onRename(id, editName.trim())
    setEditingId(null)
  }

  const handleDelete = async (id: string, keepReels: boolean) => {
    await onDelete(id, keepReels)
    setShowDeleteConfirm(null)
  }

  const handleMerge = async () => {
    if (!mergeSource || !mergeTarget || mergeSource === mergeTarget) return
    await onMerge(mergeSource, mergeTarget)
    setShowMergePanel(false)
    setMergeSource(null)
    setMergeTarget(null)
  }

  const availableReels = reels.filter(r =>
    r.ingestStatus === 'complete' &&
    !collections.find(c => c.id === showAddReelPanel)?.reelIds?.includes(r.id)
  )

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Collections</h2>
          <p className="text-sm text-zinc-500">{collections.length} collections · {reels.filter(r => r.ingestStatus === 'complete').length} reels classified</p>
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
          <button onClick={() => setShowMergePanel(!showMergePanel)}
            className={`flex items-center gap-1.5 px-3 min-h-[44px] rounded-lg text-sm font-medium transition-colors ${showMergePanel ? 'bg-amber-600 hover:bg-amber-500' : 'bg-zinc-700 hover:bg-zinc-600'}`}>
            <GitMerge size={14} /> Merge
          </button>
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

      {/* Merge panel */}
      {showMergePanel && (
        <div className="bg-zinc-900 border border-amber-500/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm text-amber-400">Merge Collections</h3>
            <button onClick={() => { setShowMergePanel(false); setMergeSource(null); setMergeTarget(null) }}
              className="min-w-[36px] min-h-[36px] flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"><X size={16} /></button>
          </div>
          <p className="text-xs text-zinc-500">Merge one collection into another. All reels from the source will be moved to the target.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Source (will be deleted)</label>
              <select value={mergeSource || ''} onChange={e => setMergeSource(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 min-h-[48px] text-sm focus:outline-none focus:border-amber-500">
                <option value="">Select source...</option>
                {collections.map(c => <option key={c.id} value={c.id}>{c.name} ({c.reelIds?.length || 0} reels)</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Target (will keep all reels)</label>
              <select value={mergeTarget || ''} onChange={e => setMergeTarget(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 min-h-[48px] text-sm focus:outline-none focus:border-amber-500">
                <option value="">Select target...</option>
                {collections.filter(c => c.id !== mergeSource).map(c => <option key={c.id} value={c.id}>{c.name} ({c.reelIds?.length || 0} reels)</option>)}
              </select>
            </div>
          </div>
          <button onClick={handleMerge} disabled={!mergeSource || !mergeTarget || mergeSource === mergeTarget}
            className="w-full min-h-[48px] bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors">
            Merge Collections
          </button>
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

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="bg-zinc-900 border border-red-500/30 rounded-xl p-4 space-y-3">
          <h3 className="font-medium text-sm text-red-400">Delete Collection?</h3>
          <p className="text-xs text-zinc-400">
            "{collections.find(c => c.id === showDeleteConfirm)?.name}" has {collections.find(c => c.id === showDeleteConfirm)?.reelIds?.length || 0} reels.
          </p>
          <div className="flex gap-2">
            <button onClick={() => handleDelete(showDeleteConfirm, true)}
              className="flex-1 min-h-[44px] bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm font-medium transition-colors">
              Delete Collection Only
            </button>
            <button onClick={() => handleDelete(showDeleteConfirm, false)}
              className="flex-1 min-h-[44px] bg-red-600 hover:bg-red-500 rounded-lg text-sm font-medium transition-colors">
              Delete Everything
            </button>
            <button onClick={() => setShowDeleteConfirm(null)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Add reel to collection panel */}
      {showAddReelPanel && (
        <div className="bg-zinc-900 border border-indigo-500/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm text-indigo-400">
              Add Reel to "{collections.find(c => c.id === showAddReelPanel)?.name}"
            </h3>
            <button onClick={() => setShowAddReelPanel(null)}
              className="min-w-[36px] min-h-[36px] flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"><X size={16} /></button>
          </div>
          <div className="max-h-60 overflow-auto space-y-1">
            {availableReels.length === 0 && (
              <p className="text-xs text-zinc-500 py-4 text-center">All reels already in this collection.</p>
            )}
            {availableReels.map(r => (
              <button key={r.id} onClick={async () => {
                await onAddReel(showAddReelPanel, r.id)
              }}
                className="w-full flex items-center gap-2 px-3 min-h-[40px] rounded-lg text-xs hover:bg-zinc-800/50 transition-colors text-left group"
              >
                <Tag size={10} className="text-zinc-500 shrink-0" />
                <span className="truncate flex-1 text-zinc-300 group-hover:text-white">{r.title || 'Untitled'}</span>
                <span className="text-zinc-600 shrink-0">@{r.creatorHandle}</span>
                <Plus size={10} className="text-indigo-400 shrink-0 opacity-0 group-hover:opacity-100 transition-all" />
              </button>
            ))}
          </div>
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
                  {editingId === c.id ? (
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <input value={editName} onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleRename(c.id); if (e.key === 'Escape') setEditingId(null) }}
                        className="flex-1 bg-zinc-800 border border-indigo-500 rounded px-2 py-1 text-sm focus:outline-none"
                        autoFocus />
                      <button onClick={() => handleRename(c.id)} className="min-w-[32px] min-h-[32px] flex items-center justify-center text-indigo-400 hover:bg-zinc-800 rounded text-xs">Save</button>
                      <button onClick={() => setEditingId(null)} className="min-w-[32px] min-h-[32px] flex items-center justify-center text-zinc-500 hover:bg-zinc-800 rounded text-xs">Cancel</button>
                    </div>
                  ) : (
                    <>
                      <p className="font-medium text-sm">{c.name}</p>
                      {c.description && <p className="text-xs text-zinc-500 truncate">{c.description}</p>}
                    </>
                  )}
                </div>
                <span className="text-xs text-zinc-500 shrink-0">{reelCount} reels</span>
                {editingId !== c.id && (
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setEditingId(c.id); setEditName(c.name) }}
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center text-zinc-600 hover:text-indigo-400 transition-colors">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setShowAddReelPanel(c.id)}
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center text-zinc-600 hover:text-indigo-400 transition-colors">
                      <Plus size={14} />
                    </button>
                    <button onClick={() => setShowDeleteConfirm(c.id)}
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center text-zinc-600 hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                    <ChevronRight size={14} className={`text-zinc-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </div>
                )}
              </div>
              {isExpanded && collectionReels.length > 0 && (
                <div className="border-t border-zinc-800 p-3 space-y-1">
                  {collectionReels.map(r => (
                    <div key={r.id} className="flex items-center gap-2 px-3 min-h-[40px] rounded-lg text-xs hover:bg-zinc-800/50 transition-colors group">
                      <GripVertical size={10} className="text-zinc-700 shrink-0 cursor-grab" />
                      <button onClick={() => onReelClick?.(r.id)}
                        className="flex-1 flex items-center gap-2 text-left min-w-0">
                        <Tag size={10} className="text-zinc-500 shrink-0" />
                        <span className="truncate text-zinc-300 group-hover:text-white transition-colors">{r.title || 'Untitled'}</span>
                        <span className="text-zinc-600 shrink-0">@{r.creatorHandle}</span>
                        <ArrowRight size={10} className="text-zinc-600 group-hover:text-indigo-400 shrink-0 opacity-0 group-hover:opacity-100 transition-all" />
                      </button>
                      <button onClick={() => onRemoveReel(c.id, r.id)}
                        className="min-w-[32px] min-h-[32px] flex items-center justify-center text-zinc-700 hover:text-red-400 shrink-0 opacity-0 group-hover:opacity-100 transition-all">
                        <X size={12} />
                      </button>
                    </div>
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
            <p className="text-xs mt-1 text-zinc-600">Ingest some reels, then click "Auto-Assign All" to classify them.</p>
          </div>
        )}
      </div>
    </div>
  )
}
