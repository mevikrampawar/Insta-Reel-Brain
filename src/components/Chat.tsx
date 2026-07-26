import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Send, Loader2, BookOpen, AlertCircle, Trash2, Hash, Lightbulb } from 'lucide-react'
import type { Reel } from '../types'
import { chatWithLibrary } from '../services/groq'
import { keywordSearch } from '../utils/search'

interface Props { reels: Reel[]; apiKey: string }

interface Message {
  role: 'user' | 'assistant'
  content: string
  citations?: { reelId: string; title: string; creator: string }[]
}

const STORAGE_KEY = 'reelbrain-chat-history'

function loadHistory(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return []
}

function saveHistory(msgs: Message[]) {
  try {
    // Keep last 50 messages to avoid storage bloat
    localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-50)))
  } catch { /* ignore */ }
}

export function Chat({ reels, apiKey }: Props) {
  const [messages, setMessages] = useState<Message[]>(loadHistory)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { saveHistory(messages) }, [messages])

  const completeReels = reels.filter(r => r.ingestStatus === 'complete')

  // Dynamic suggestion chips based on library content
  const suggestions = useMemo(() => {
    const chips: string[] = []
    const tagCounts = new Map<string, number>()
    completeReels.forEach(r => r.suggestedTags?.forEach(t => tagCounts.set(t, (tagCounts.get(t) || 0) + 1)))
    const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
    if (topTags.length > 0) chips.push(`Tell me about ${topTags[0][0]}`)
    if (topTags.length > 1) chips.push(`How does ${topTags[1][0]} relate to ${topTags[0][0]}?`)

    const entityCounts = new Map<string, number>()
    completeReels.forEach(r => r.entities?.forEach(e => entityCounts.set(e.name, (entityCounts.get(e.name) || 0) + 1)))
    const topEntities = [...entityCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2)
    if (topEntities.length > 0) chips.push(`What do I know about ${topEntities[0][0]}?`)

    if (chips.length < 3) chips.push('Summarize my saved Reels')
    if (chips.length < 3) chips.push('What action items should I prioritize?')
    return chips.slice(0, 4)
  }, [completeReels])

  const handleSend = async (text?: string) => {
    const q = text || input.trim()
    if (!q || loading) return
    if (!apiKey) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Please add your Groq API key in Settings to use chat.' }])
      return
    }
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: q }])
    setLoading(true)

    try {
      const relevantResults = keywordSearch(completeReels, q)
      const relevantReels = relevantResults.length > 0
        ? relevantResults.slice(0, 10).map(r => r.reel)
        : completeReels.slice(0, 10)

      const context = relevantReels.map((r, i) => ({
        reelNumber: i + 1,
        title: r.title || 'Untitled',
        creator: r.creatorHandle || 'unknown',
        summary: r.summary || '',
        transcript: r.transcript || '',
        tags: r.suggestedTags || [],
        entities: (r.entities || []).map(e => `${e.name} (${e.type})`).join(', '),
        actionItems: r.actionItems || [],
        topComments: (r.topComments || []).slice(0, 3).map(c => `${c.author}: ${c.text}`).join('\n'),
      }))

      const answer = await chatWithLibrary(apiKey, q, context)

      // Extract citations from context (reels that were included)
      const citations = relevantReels.slice(0, 5).map(r => ({
        reelId: r.id,
        title: r.title || 'Untitled',
        creator: r.creatorHandle || 'unknown',
      }))

      setMessages(prev => [...prev, { role: 'assistant', content: answer, citations }])
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${e instanceof Error ? e.message : 'Failed to get response'}`,
      }])
    }
    setLoading(false)
  }

  const clearHistory = useCallback(() => {
    setMessages([])
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <BookOpen size={18} className="text-indigo-400" />
          <h2 className="font-bold">Chat with Library</h2>
          <span className="text-xs text-zinc-500">({completeReels.length} reels)</span>
          {messages.length > 0 && (
            <button onClick={clearHistory} className="ml-auto p-1.5 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-zinc-800 transition-colors" title="Clear history">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {!apiKey && (
          <div className="text-center py-8 space-y-2">
            <AlertCircle size={24} className="mx-auto text-amber-400" />
            <p className="text-sm text-zinc-400">Add your Groq API key in Settings to use chat</p>
          </div>
        )}

        {messages.length === 0 && apiKey && (
          <div className="text-center py-12 space-y-4">
            <BookOpen size={32} className="mx-auto text-zinc-600" />
            <p className="text-zinc-400 text-sm">Ask anything about your saved Reels</p>
            <div className="flex flex-wrap justify-center gap-2 max-w-md mx-auto">
              {suggestions.map(q => (
                <button key={q} onClick={() => handleSend(q)}
                  className="px-3 min-h-[40px] bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5">
                  <Lightbulb size={12} className="text-amber-400 shrink-0" />
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] md:max-w-[75%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
              m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-200'
            }`}>
              {m.content.split('\n').map((line, j) => (
                <p key={j} className={j > 0 ? 'mt-2' : ''}>{line}</p>
              ))}
              {/* Citations */}
              {m.citations && m.citations.length > 0 && (
                <div className="mt-3 pt-2 border-t border-zinc-700/50">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-medium">Sources</p>
                  <div className="flex flex-wrap gap-1">
                    {m.citations.map((c, ci) => (
                      <span key={ci} className="inline-flex items-center gap-1 text-[10px] text-zinc-400 bg-zinc-700/30 px-1.5 py-0.5 rounded">
                        <Hash size={8} className="text-indigo-400" />
                        {c.title.slice(0, 20)}{c.title.length > 20 ? '...' : ''} by @{c.creator}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-zinc-800 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-zinc-400">
              <Loader2 size={14} className="animate-spin" /> Thinking...
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-zinc-800">
        <div className="flex gap-2">
          <input
            value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={apiKey ? "Ask about your Reels..." : "Add API key in Settings first..."}
            disabled={!apiKey}
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 min-h-[48px] text-sm focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
          />
          <button onClick={() => handleSend()} disabled={loading || !input.trim() || !apiKey}
            className="min-w-[48px] min-h-[48px] flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg transition-colors">
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
