import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, BookOpen, AlertCircle } from 'lucide-react'
import type { Reel } from '../types'
import { chatWithLibrary } from '../services/groq'
import { keywordSearch } from '../utils/search'

interface Props { reels: Reel[]; apiKey: string }

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function Chat({ reels, apiKey }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const completeReels = reels.filter(r => r.ingestStatus === 'complete')

  const handleSend = async () => {
    if (!input.trim() || loading) return
    if (!apiKey) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Please add your Groq API key in Settings to use chat.' }])
      return
    }
    const q = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: q }])
    setLoading(true)

    try {
      // Smart context: find most relevant reels for the question
      const relevantResults = keywordSearch(completeReels, q)
      const relevantReels = relevantResults.length > 0
        ? relevantResults.slice(0, 10).map(r => r.reel)
        : completeReels.slice(0, 10) // Fallback to first 10 if no keyword matches

      const context = relevantReels.map(r => ({
        title: r.title || 'Untitled',
        summary: r.summary || '',
        transcript: r.transcript || '',
        tags: r.suggestedTags || [],
      }))
      const answer = await chatWithLibrary(apiKey, q, context)
      setMessages(prev => [...prev, { role: 'assistant', content: answer }])
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${e instanceof Error ? e.message : 'Failed to get response'}`,
      }])
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <BookOpen size={18} className="text-indigo-400" />
          <h2 className="font-bold">Chat with Library</h2>
          <span className="text-xs text-zinc-500">({completeReels.length} reels indexed)</span>
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
          <div className="text-center py-12 space-y-3">
            <BookOpen size={32} className="mx-auto text-zinc-600" />
            <p className="text-zinc-400 text-sm">Ask anything about your saved Reels</p>
            <div className="flex flex-wrap justify-center gap-2 text-xs">
              {['What are the main topics I save?', 'Summarize fitness tips', 'Find reels about productivity'].map(q => (
                <button key={q} onClick={() => setInput(q)}
                  className="px-3 min-h-[40px] bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-colors">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
              m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-200'
            }`}>
              {m.content.split('\n').map((line, j) => (
                <p key={j} className={j > 0 ? 'mt-2' : ''}>{line}</p>
              ))}
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

      <div className="p-4 border-t border-zinc-800">
        <div className="flex gap-2">
          <input
            value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={apiKey ? "Ask about your Reels..." : "Add API key in Settings first..."}
            disabled={!apiKey}
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 min-h-[48px] text-sm focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
          />
          <button onClick={handleSend} disabled={loading || !input.trim() || !apiKey}
            className="min-w-[48px] min-h-[48px] flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg transition-colors">
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
