import { useState } from 'react'
import { Link, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import type { Reel } from '../types'
import { analyzeReel, generateEmbedding } from '../services/gemini'

interface Props {
  userId: string
  addReel: (data: Partial<Reel>) => Promise<string | undefined>
  updateReel: (id: string, data: Partial<Reel>) => Promise<void>
  onDone: () => void
}

export function IngestionForm({ addReel, updateReel, onDone }: Props) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [creatorHandle, setCreatorHandle] = useState('')
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [transcript, setTranscript] = useState('')
  const [status, setStatus] = useState<'idle' | 'ingesting' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')

  const handleIngest = async () => {
    if (!transcript.trim()) { setError('Please paste a transcript or caption'); return }
    setStatus('ingesting')
    setError('')

    try {
      const id = await addReel({
        url: url || 'manual-entry',
        title: title || 'Untitled Reel',
        creatorHandle,
        caption,
        hashtags: hashtags.split(',').map(t => t.trim()).filter(Boolean),
      })
      if (!id) throw new Error('Failed to create reel')

      setProgress('Analyzing with AI...')
      const analysis = await analyzeReel(transcript, {
        creator: creatorHandle,
        caption,
        hashtags: hashtags.split(',').map(t => t.trim()).filter(Boolean),
      })

      setProgress('Generating embedding...')
      const embText = [analysis.summary, ...analysis.keyTakeaways, ...analysis.suggestedTags, transcript].join(' ')
      const embedding = await generateEmbedding(embText)

      await updateReel(id, {
        ingestStatus: 'complete',
        transcript,
        summary: analysis.summary,
        keyTakeaways: analysis.keyTakeaways,
        suggestedTags: analysis.suggestedTags,
        embedding,
        concepts: analysis.concepts.map(c => ({ conceptName: c.name, conceptType: c.type, weight: 0.7 })),
        language: analysis.language,
        ingestedAt: Date.now(),
      })

      setStatus('done')
      setTimeout(onDone, 1500)
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Ingestion failed')
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <h2 className="text-2xl font-bold">Add Reel</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Reel URL (optional)</label>
          <div className="relative">
            <Link size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://www.instagram.com/reel/..."
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Reel title"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Creator Handle</label>
            <input value={creatorHandle} onChange={e => setCreatorHandle(e.target.value)} placeholder="@username"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
          </div>
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Caption</label>
          <input value={caption} onChange={e => setCaption(e.target.value)} placeholder="Reel caption"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Hashtags (comma-separated)</label>
          <input value={hashtags} onChange={e => setHashtags(e.target.value)} placeholder="#productivity, #ai, #tips"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Transcript / Content *</label>
          <textarea value={transcript} onChange={e => setTranscript(e.target.value)}
            placeholder="Paste the Reel's transcript or describe its content. The more detail, the better the AI analysis."
            rows={6}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none" />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg p-3">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <button
        onClick={handleIngest}
        disabled={status === 'ingesting' || !transcript.trim()}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
      >
        {status === 'ingesting' && <><Loader2 size={16} className="animate-spin" /> {progress}</>}
        {status === 'done' && <><CheckCircle2 size={16} /> Done!</>}
        {status === 'idle' && 'Analyze & Save'}
        {status === 'error' && 'Retry'}
      </button>
    </div>
  )
}
