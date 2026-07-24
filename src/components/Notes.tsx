import { useState } from 'react'
import { StickyNote, Plus, Trash2, Edit3, Check, X } from 'lucide-react'
import type { ReelNote } from '../types'

interface Props {
  notes: ReelNote[]
  reelTitle: string
  onAdd: (data: Partial<ReelNote>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function Notes({ notes, reelTitle, onAdd, onDelete }: Props) {
  const [content, setContent] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  const handleAdd = async () => {
    if (!content.trim()) return
    await onAdd({ content: content.trim() })
    setContent('')
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <StickyNote size={14} className="text-amber-400" />
        <h4 className="text-xs font-medium text-zinc-400">Notes for "{reelTitle}"</h4>
      </div>

      {/* Add note */}
      <div className="flex gap-2">
        <textarea
          value={content} onChange={e => setContent(e.target.value)}
          placeholder="Add a note..."
          rows={2}
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 resize-none"
        />
        <button onClick={handleAdd} disabled={!content.trim()}
          className="self-end px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg transition-colors">
          <Plus size={14} />
        </button>
      </div>

      {/* Notes list */}
      <div className="space-y-2">
        {notes.map(note => (
          <div key={note.id} className="bg-zinc-800/50 rounded-lg p-3 group">
            {editingId === note.id ? (
              <div className="flex gap-2">
                <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs resize-none" rows={2} />
                <button className="text-emerald-400"><Check size={12} /></button>
                <button onClick={() => setEditingId(null)} className="text-zinc-500"><X size={12} /></button>
              </div>
            ) : (
              <>
                <p className="text-xs text-zinc-300 whitespace-pre-wrap">{note.content}</p>
                <div className="flex items-center justify-between mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] text-zinc-600">{new Date(note.createdAt).toLocaleDateString()}</span>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingId(note.id); setEditContent(note.content) }}
                      className="text-zinc-600 hover:text-zinc-300"><Edit3 size={10} /></button>
                    <button onClick={() => onDelete(note.id)}
                      className="text-zinc-600 hover:text-red-400"><Trash2 size={10} /></button>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
        {notes.length === 0 && (
          <p className="text-xs text-zinc-600 text-center py-2">No notes yet</p>
        )}
      </div>
    </div>
  )
}
