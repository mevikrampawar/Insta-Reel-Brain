import { useState } from 'react'
import { Link, Loader2, AlertCircle, Sparkles, CheckCircle2, Video } from 'lucide-react'
import type { Reel } from '../types'
import { processReel } from '../services/ingestion'

interface Props {
  userId: string
  addReel: (data: Partial<Reel>) => Promise<string | undefined>
  updateReel: (id: string, data: Partial<Reel>) => Promise<void>
  onDone: () => void
  apiKey: string
}

type Step = 'form' | 'processing' | 'done' | 'error'

export function IngestionForm({ addReel, updateReel, onDone, apiKey }: Props) {
  const [step, setStep] = useState<Step>('form')
  const [url, setUrl] = useState('')
  const [transcript, setTranscript] = useState('')
  const [title, setTitle] = useState('')
  const [creator, setCreator] = useState('')
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')

  if (!apiKey) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6 text-center space-y-3">
          <AlertCircle className="mx-auto text-amber-400" size={32} />
          <h3 className="font-medium text-amber-300">API Key Required</h3>
          <p className="text-sm text-zinc-400">
            Go to <strong>Settings</strong> and add your free Groq API key to use AI features.
          </p>
          <p className="text-xs text-zinc-500">
            Get one free at <a href="https://console.groq.com" target="_blank" rel="noopener" className="text-indigo-400 underline">console.groq.com</a>
          </p>
        </div>
      </div>
    )
  }

  const handleProcess = async () => {
    if (!transcript.trim()) { setError('Please paste the transcript or content'); return }
    setError('')
    setStep('processing')
    setProgress('Creating Reel entry...')

    try {
      const id = await addReel({
        url: url || 'manual-entry',
        title: title || 'Untitled Reel',
        creatorHandle: creator,
        caption,
        hashtags: hashtags.split(',').map(t => t.trim()).filter(Boolean),
      })
      if (!id) throw new Error('Failed to create reel')

      await processReel(
        apiKey,
        {
          url: url || 'manual-entry',
          transcript,
          title,
          creatorHandle: creator,
          caption,
          hashtags: hashtags.split(',').map(t => t.trim()),
        },
        id,
        updateReel,
        setProgress,
      )

      setStep('done')
      setTimeout(onDone, 1500)
    } catch (e) {
      setStep('error')
      setError(e instanceof Error ? e.message : 'Processing failed')
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
          <Video size={20} />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Add Reel</h2>
          <p className="text-sm text-zinc-500">Paste the link and transcript — AI handles the rest</p>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-xs text-zinc-400 space-y-1">
        <p className="font-medium text-zinc-300 mb-1">How it works:</p>
        <p>1. Copy the Reel link from Instagram</p>
        <p>2. Get the transcript (copy captions, or describe the content)</p>
        <p>3. Paste both below → AI generates summary, tags, embeddings, and more</p>
      </div>

      <div className="space-y-4">
        {/* URL */}
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Reel URL</label>
          <div className="relative">
            <Link size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://www.instagram.com/reel/..."
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>

        {/* Title + Creator */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="What's this Reel about?"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Creator</label>
            <input value={creator} onChange={e => setCreator(e.target.value)} placeholder="@username"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
          </div>
        </div>

        {/* Caption */}
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Caption</label>
          <input value={caption} onChange={e => setCaption(e.target.value)} placeholder="Original caption from the Reel"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
        </div>

        {/* Hashtags */}
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Hashtags</label>
          <input value={hashtags} onChange={e => setHashtags(e.target.value)} placeholder="#productivity, #ai, #tips"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
        </div>

        {/* Transcript */}
        <div>
          <label className="block text-sm text-zinc-400 mb-1">
            Transcript / Content <span className="text-red-400">*</span>
          </label>
          <textarea
            value={transcript} onChange={e => setTranscript(e.target.value)}
            placeholder={"Paste the Reel's transcript here. You can:\n• Copy the captions/text from the Reel\n• Describe what the Reel is about\n• Paste any notes you took while watching\n\nThe more detail, the better the AI analysis."}
            rows={10}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none"
          />
          <p className="text-xs text-zinc-600 mt-1">
            {transcript.length > 0 ? `${transcript.length} characters` : 'Required — AI cannot watch videos, it needs text'}
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg p-3">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <button
        onClick={handleProcess}
        disabled={step === 'processing' || !transcript.trim()}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
      >
        {step === 'processing' && <><Loader2 size={16} className="animate-spin" /> {progress}</>}
        {step === 'done' && <><CheckCircle2 size={16} /> Done!</>}
        {step === 'form' && <><Sparkles size={16} /> Analyze with AI</>}
        {step === 'error' && 'Retry'}
      </button>
    </div>
  )
}
