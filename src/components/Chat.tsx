import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { User, Bot, ArrowUp, Trash2, Copy, Check, RefreshCw, Sparkles } from 'lucide-react'
import type { Reel } from '../types'
import { keywordSearch } from '../utils/search'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Props {
  reels: Reel[]
  apiKey: string
  onReelClick: (reelId: string) => void
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: { reelId: string; title: string; creator: string }[]
  error?: boolean
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-50)))
  } catch { /* ignore */ }
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

function renderMarkdown(text: string): string {
  let html = text
  // Code blocks
  html = html.replace(/```([\s\S]*?)```/g, '<pre class="bg-muted/50 rounded-lg p-3 text-sm overflow-x-auto my-2"><code>$1</code></pre>')
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-muted/50 rounded px-1 py-0.5 text-sm">$1</code>')
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary underline hover:text-primary/80 transition-colors">$1</a>')
  // Paragraphs
  html = html.split('\n\n').map(p => `<p class="mb-2 last:mb-0">${p}</p>`).join('')
  // Line breaks within paragraphs
  html = html.replace(/\n/g, '<br/>')
  return html
}

function buildContext(completeReels: Reel[], query: string) {
  const relevantResults = keywordSearch(completeReels, query)
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

  const citations = relevantReels.slice(0, 5).map(r => ({
    reelId: r.id,
    title: r.title || 'Untitled',
    creator: r.creatorHandle || 'unknown',
  }))

  return { context, citations }
}

function buildSystemPrompt() {
  return `You are a helpful assistant that answers questions based on a user's saved Instagram Reel library. Use ONLY the provided Reels as your knowledge base. Always cite which Reel(s) you're referencing by number and creator handle (e.g., "Reel 3 by @creator"). If the library doesn't contain relevant information, say so clearly. Format citations inline like [Reel N: "title" by @creator]. Use markdown formatting for better readability.`
}

function buildUserMessage(context: ReturnType<typeof buildContext>['context'], question: string) {
  const contextStr = context.map((r) => {
    const parts = [
      `REEL ${r.reelNumber}: "${r.title}" by @${r.creator}`,
      r.tags.length > 0 ? `Tags: ${r.tags.join(', ')}` : null,
      r.entities ? `Entities: ${r.entities}` : null,
      r.summary ? `Summary: ${r.summary}` : null,
      r.transcript ? `Transcript excerpt: ${r.transcript.slice(0, 800)}` : null,
      r.actionItems && r.actionItems.length > 0 ? `Action Items: ${r.actionItems.join('; ')}` : null,
      r.topComments && r.topComments.length > 0 ? `Top Comments:\n${r.topComments}` : null,
    ].filter(Boolean)
    return parts.join('\n')
  }).join('\n\n---\n\n')

  return `MY REEL LIBRARY:\n\n${contextStr}\n\n---\n\nQUESTION: ${question}`
}

async function chatStreamWithLibrary(
  apiKey: string,
  question: string,
  context: ReturnType<typeof buildContext>['context'],
  onToken: (token: string) => void,
  onDone: () => void,
  onError: (error: Error) => void,
) {
  if (!apiKey) throw new Error('No API key configured.')

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: buildUserMessage(context, question) },
        ],
        temperature: 0.3,
        max_tokens: 2048,
        stream: true,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(`Groq API error ${res.status}: ${err.error?.message || res.statusText}`)
    }

    const reader = res.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6)
        if (data === '[DONE]') {
          onDone()
          return
        }
        try {
          const parsed = JSON.parse(data)
          const delta = parsed.choices?.[0]?.delta?.content
          if (delta) onToken(delta)
        } catch { /* skip malformed */ }
      }
    }
    onDone()
  } catch (err) {
    onError(err instanceof Error ? err : new Error('Stream failed'))
  }
}

export function Chat({ reels, apiKey, onReelClick }: Props) {
  const [messages, setMessages] = useState<Message[]>(loadHistory)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, streaming])
  useEffect(() => { saveHistory(messages) }, [messages])

  const completeReels = reels.filter(r => r.ingestStatus === 'complete')

  const suggestions = useMemo(() => {
    const chips: { label: string; prompt: string }[] = []

    const tagCounts = new Map<string, number>()
    completeReels.forEach(r => r.suggestedTags?.forEach(t => tagCounts.set(t, (tagCounts.get(t) || 0) + 1)))
    const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)

    const creatorCounts = new Map<string, number>()
    completeReels.forEach(r => {
      if (r.creatorHandle) creatorCounts.set(r.creatorHandle, (creatorCounts.get(r.creatorHandle) || 0) + 1)
    })
    const topCreators = [...creatorCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2)

    chips.push({ label: 'Summarize my top reels', prompt: 'Summarize the key themes and insights from my top saved Reels' })
    chips.push({ label: 'What are my most used hashtags?', prompt: 'What are the most frequently used hashtags across my Reel library?' })

    if (topTags.length > 0) {
      chips.push({ label: `Find reels about ${topTags[0][0]}`, prompt: `Find and summarize all reels about ${topTags[0][0]}` })
    }
    if (topCreators.length > 1) {
      chips.push({ label: 'Compare creators', prompt: `Compare the content styles of ${topCreators[0][0]} and ${topCreators[1][0]}` })
    }

    chips.push({ label: 'What content performs best?', prompt: 'Based on my saved reels, what types of content seem to perform best and why?' })
    chips.push({ label: 'Suggest new content ideas', prompt: 'Based on my existing reel library, suggest 5 new content ideas that would complement my collection' })

    return chips.slice(0, 6)
  }, [completeReels])

  const handleSend = useCallback(async (text?: string) => {
    const q = text || input.trim()
    if (!q || streaming) return
    if (!apiKey) {
      const id = uid()
      setMessages(prev => [...prev, { id, role: 'assistant', content: 'Please add your Groq API key in Settings to use chat.' }])
      return
    }

    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    const userMsg: Message = { id: uid(), role: 'user', content: q }
    const assistantId = uid()
    const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '' }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setStreaming(true)
    setStreamingMessageId(assistantId)

    const { context, citations } = buildContext(completeReels, q)

    await chatStreamWithLibrary(
      apiKey,
      q,
      context,
      (token) => {
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: m.content + token } : m
        ))
      },
      () => {
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, citations } : m
        ))
        setStreaming(false)
        setStreamingMessageId(null)
      },
      (error) => {
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: `Error: ${error.message}`, error: true } : m
        ))
        setStreaming(false)
        setStreamingMessageId(null)
      },
    )
  }, [input, streaming, apiKey, completeReels])

  const handleRetry = useCallback((msgId: string) => {
    setMessages(prev => {
      const msgIndex = prev.findIndex(m => m.id === msgId)
      if (msgIndex < 0) return prev
      // Find the user message before this assistant message
      const userMsg = prev.slice(0, msgIndex).reverse().find(m => m.role === 'user')
      if (!userMsg) return prev
      // Remove the failed message and re-send
      const newMsgs = prev.filter(m => m.id !== msgId)
      return newMsgs
    })
    // Re-trigger send with the user's original message
    const msgIndex = messages.findIndex(m => m.id === msgId)
    if (msgIndex > 0) {
      const userMsg = messages.slice(0, msgIndex).reverse().find(m => m.role === 'user')
      if (userMsg) {
        setTimeout(() => handleSend(userMsg.content), 50)
      }
    }
  }, [messages, handleSend])

  const handleCopy = useCallback((content: string, msgId: string) => {
    navigator.clipboard.writeText(content)
    setCopiedId(msgId)
    setTimeout(() => setCopiedId(null), 2000)
  }, [])

  const clearHistory = useCallback(() => {
    setMessages([])
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }, [])

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 128)}px`
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full" data-tour="chat">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles size={16} className="text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-sm">Chat with Library</h2>
            <p className="text-[11px] text-muted-foreground">{completeReels.length} reels indexed</p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={clearHistory}
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            title="Clear chat"
          >
            <Trash2 size={14} />
          </Button>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="px-5 py-4 space-y-4">
          {!apiKey && (
            <div className="text-center py-12 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
                <Sparkles size={20} className="text-destructive" />
              </div>
              <p className="text-sm text-muted-foreground">Add your Groq API key in Settings to use chat</p>
            </div>
          )}

          {/* Empty state with suggestions */}
          {messages.length === 0 && apiKey && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="text-center py-8 space-y-5"
            >
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <Sparkles size={24} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Ask anything about your reels</p>
                <p className="text-xs text-muted-foreground mt-1">Powered by your saved content</p>
              </div>
              <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
                {suggestions.map((s, i) => (
                  <motion.button
                    key={s.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.05 }}
                    onClick={() => handleSend(s.prompt)}
                    className="glass-card px-3.5 py-2.5 text-left text-xs text-muted-foreground hover:text-foreground transition-all duration-200 hover:border-primary/30 cursor-pointer"
                  >
                    {s.label}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Message list */}
          <AnimatePresence mode="popLayout">
            {messages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  'flex gap-3 group',
                  m.role === 'user' ? 'justify-end' : 'justify-start'
                )}
                onMouseEnter={() => setHoveredId(m.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {m.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot size={14} className="text-primary" />
                  </div>
                )}

                <div className={cn('relative max-w-[80%] min-w-0', m.role === 'user' && 'order-1')}>
                  <div
                    className={cn(
                      'px-4 py-2.5 text-sm leading-relaxed',
                      m.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-md'
                        : 'bg-card border border-border rounded-2xl rounded-bl-md',
                      m.error && 'border-destructive/50 bg-destructive/5',
                      m.id === streamingMessageId && 'streaming-cursor'
                    )}
                  >
                    {m.content ? (
                      m.role === 'assistant' ? (
                        <div
                          className="prose prose-invert prose-sm max-w-none [&_p]:mb-2 [&_p:last-child]:mb-0 [&_pre]:my-2 [&_code]:text-xs"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }}
                        />
                      ) : (
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      )
                    ) : m.id === streamingMessageId ? (
                      <div className="flex items-center gap-1.5 py-1">
                        <span className="typing-dot w-1.5 h-1.5 rounded-full bg-primary/60" />
                        <span className="typing-dot w-1.5 h-1.5 rounded-full bg-primary/60" />
                        <span className="typing-dot w-1.5 h-1.5 rounded-full bg-primary/60" />
                      </div>
                    ) : null}
                  </div>

                  {/* Citations */}
                  {m.citations && m.citations.length > 0 && (
                    <div className="mt-1.5 px-1">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-medium">Sources</p>
                      <div className="flex flex-wrap gap-1">
                        {m.citations.map((c) => (
                          <button
                            key={c.reelId}
                            onClick={() => onReelClick(c.reelId)}
                            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-full hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                          >
                            {c.title.slice(0, 18)}{c.title.length > 18 ? '…' : ''} @{c.creator}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions for assistant messages */}
                  {m.role === 'assistant' && m.content && m.id !== streamingMessageId && (
                    <div className={cn(
                      'flex items-center gap-1 mt-1 transition-opacity',
                      hoveredId === m.id ? 'opacity-100' : 'opacity-0'
                    )}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleCopy(m.content, m.id)}
                        title="Copy"
                      >
                        {copiedId === m.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      </Button>
                      {m.error && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleRetry(m.id)}
                          title="Retry"
                        >
                          <RefreshCw size={12} />
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {m.role === 'user' && (
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5 order-2">
                    <User size={14} className="text-muted-foreground" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={endRef} />
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="border-t border-border px-5 py-3">
        <div className="flex items-end gap-2 glass-card p-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={apiKey ? 'Ask about your reels...' : 'Add API key in Settings first...'}
            disabled={!apiKey || streaming}
            rows={1}
            className="flex-1 bg-transparent border-0 outline-none resize-none text-sm text-foreground placeholder:text-muted-foreground min-h-[36px] max-h-[128px] px-2 py-1.5 disabled:opacity-50"
            aria-label="Chat message"
          />
          <Button
            size="icon"
            className="h-9 w-9 rounded-xl shrink-0"
            disabled={streaming || !input.trim() || !apiKey}
            onClick={() => handleSend()}
          >
            <ArrowUp size={16} />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          AI responses based on your reel library. Verify important information.
        </p>
      </div>
    </div>
  )
}
