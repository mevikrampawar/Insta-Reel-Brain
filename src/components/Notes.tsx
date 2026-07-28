import { useState, useRef, useEffect } from 'react'
import { StickyNote, Plus, Trash2, Edit3, Check, X, Loader2 } from 'lucide-react'
import type { ReelNote } from '../types'

interface Props {
  notes: ReelNote[]
  reelTitle: string
  onAdd: (data: Partial<ReelNote>) => Promise<void>
  onUpdate: (id: string, content: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  loading?: boolean
}

export function Notes({ notes, reelTitle, onAdd, onUpdate, onDelete, loading }: Props) {
  const [content, setContent] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const addRef = useRef<HTMLTextAreaElement>(null)
  const editRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editingId && editRef.current) editRef.current.focus()
  }, [editingId])

  const handleAdd = async () => {
    if (!content.trim() || saving) return
    setSaving(true)
    try {
      await onAdd({ content: content.trim() })
      setContent('')
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async (id: string) => {
    if (!editContent.trim() || saving) return
    setSaving(true)
    try {
      await onUpdate(id, editContent.trim())
      setEditingId(null)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await onDelete(id)
    } finally {
      setDeletingId(null)
    }
  }

  const handleAddKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleAdd()
    }
  }

  const handleEditKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSave(id)
    }
    if (e.key === 'Escape') {
      setEditingId(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <StickyNote size={14} className="text-amber-400" />
        <h4 className="text-xs font-medium text-zinc-400">Notes for &ldquo;{reelTitle}&rdquo;</h4>
      </div>

      <div className="flex gap-2">
        <textarea
          ref={addRef}
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={handleAddKeyDown}
          placeholder="Add a note... (Cmd+Enter to save)"
          rows={2}
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 resize-none"
        />
        <button onClick={handleAdd} disabled={!content.trim() || saving}
          className="self-end min-w-[40px] min-h-[40px] flex items-center justify-center px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg transition-colors">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
        </button>
      </div>

      <div className="space-y-2">
        {loading && notes.length === 0 && (
          <div className="flex items-center justify-center py-4">
            <Loader2 size={16} className="animate-spin text-zinc-600" />
          </div>
        )}
        {!loading && notes.length === 0 && (
          <p className="text-xs text-zinc-600 text-center py-2">No notes yet</p>
        )}
        {notes.map(note => (
          <div key={note.id} className="bg-zinc-800/50 rounded-lg p-3">
            {editingId === note.id ? (
              <div className="flex gap-2">
                <textarea ref={editRef} value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  onKeyDown={e => handleEditKeyDown(e, note.id)}
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs resize-none" rows={2} />
                <button onClick={() => handleSave(note.id)} disabled={!editContent.trim() || saving}
                  className="min-w-[36px] min-h-[36px] flex items-center justify-center text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors disabled:opacity-50"><Check size={14} /></button>
                <button onClick={() => setEditingId(null)}
                  className="min-w-[36px] min-h-[36px] flex items-center justify-center text-zinc-500 hover:bg-zinc-700/50 rounded-lg transition-colors"><X size={14} /></button>
              </div>
            ) : (
              <>
                <p className="text-xs text-zinc-300 whitespace-pre-wrap">{note.content}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-zinc-600">{new Date(note.createdAt).toLocaleDateString()}</span>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingId(note.id); setEditContent(note.content) }}
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50 rounded-lg transition-colors"><Edit3 size={13} /></button>
                    {deletingId === note.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDelete(note.id)}
                          className="text-[10px] text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded bg-red-500/10">Delete</button>
                        <button onClick={() => setDeletingId(null)}
                          className="text-[10px] text-zinc-500 hover:text-zinc-300 px-1.5 py-0.5 rounded">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeletingId(note.id)}
                        className="min-w-[36px] min-h-[36px] flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 size={13} /></button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
