import { useState } from 'react'
import { Link, Loader2, AlertCircle, Sparkles, RotateCcw } from 'lucide-react'
import type { Reel } from '../types'
import { scrapeInstagramUrl, processReel } from '../services/ingestion'

interface Props {
  userId: string
  addReel: (data: Partial<Reel>) => Promise<string | undefined>
  updateReel: (id: string, data: Partial<Reel>) => Promise<void>
  onDone: () => void
  apiKey: string
}

type Step = 'url' | 'fetching' | 'review' | 'processing' | 'done' | 'error'

export function IngestionForm({ addReel, updateReel, onDone, apiKey }: Props) {
  const [step, setStep] = useState<Step>('url')
  const [url, setUrl] = useState('')
  const [transcript, setTranscript] = useState('')
  const [title, setTitle] = useState('')
  const [creator, setCreator] = useState('')
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
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

  const handleUrlSubmit = async () => {
    if (!url.trim()) { setError('Please enter a Reel URL'); return }
    setError('')
    setStep('fetching')
    setProgress('Fetching Reel page...')
    try {
      const meta = await scrapeInstagramUrl(apiKey, url)
      setTitle(meta.title)
      setCreator(meta.creator)
      setCaption(meta.caption)
      setHashtags(meta.hashtags.join(', '))
      setThumbnailUrl(meta.thumbnailUrl)
      setStep('review')
    } catch {
      setStep('review')
      setError('Could not auto-fetch metadata. Please fill in details below.')
    }
  }

  const handleProcess = async () => {
    if (!transcript.trim()) { setError('Please paste the transcript or content'); return }
    setError('')
    setStep('processing')
    setProgress('Creating Reel entry...')
    try {
      const id = await addReel({
        url,
        title: title || 'Untitled Reel',
        creatorHandle: creator,
        caption,
        hashtags: hashtags.split(',').map(t => t.trim()).filter(Boolean),
        thumbnailUrl,
      })
      if (!id) throw new Error('Failed to create reel')
      await processReel(
        apiKey,
        { url, transcript, title, creatorHandle: creator, caption, hashtags: hashtags.split(',').map(t => t.trim()), thumbnailUrl },
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

  const isUrlStep = step === 'url' || step === 'fetching'
  const isReviewStep = step === 'review' || step === 'processing'

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
          <Sparkles size={20} />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Add Reel</h2>
          <p className="text-sm text-zinc-500">Paste a URL — AI handles the rest</p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs">
        {['URL', 'Review', 'Process'].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
              (step === 'url' && i === 0) || (step === 'fetching' && i === 0) ? 'bg-indigo-600 text-white' :
              (step === 'review' && i <= 1) || (step === 'processing' && i <= 1) || step === 'done' ? 'bg-emerald-600 text-white' :
              'bg-zinc-800 text-zinc-500'
            }`}>{i + 1}</div>
            <span className="text-zinc-400">{label}</span>
            {i < 2 && <div className="w-8 h-px bg-zinc-700" />}
          </div>
        ))}
      </div>

      {isUrlStep && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Instagram Reel URL</label>
            <div className="relative">
              <Link size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input value={url} onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleUrlSubmit()}
                placeholder="https://www.instagram.com/reel/..."
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                autoFocus />
            </div>
          </div>
          <button onClick={handleUrlSubmit} disabled={step === 'fetching' || !url.trim()}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center justify-center gap-2">
            {step === 'fetching' ? <><Loader2 size={16} className="animate-spin" /> {progress}</> : <><Sparkles size={16} /> Auto-extract & Continue</>}
          </button>
        </div>
      )}

      {isReviewStep && (
        <div className="space-y-4">
          {thumbnailUrl && (
            <div className="flex gap-4 items-start">
              <img src={thumbnailUrl} className="w-24 h-24 rounded-lg object-cover bg-zinc-800" alt="" onError={e => (e.target as HTMLImageElement).style.display = 'none'} />
              <div className="flex-1 space-y-2">
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
                <input value={creator} onChange={e => setCreator(e.target.value)} placeholder="Creator @handle"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
              </div>
            </div>
          )}
          {!thumbnailUrl && (
            <div className="grid grid-cols-2 gap-3">
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title"
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
              <input value={creator} onChange={e => setCreator(e.target.value)} placeholder="Creator @handle"
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
            </div>
          )}
          <input value={caption} onChange={e => setCaption(e.target.value)} placeholder="Caption"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
          <input value={hashtags} onChange={e => setHashtags(e.target.value)} placeholder="Hashtags (comma-separated)"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Transcript / Content <span className="text-red-400">*</span></label>
            <textarea value={transcript} onChange={e => setTranscript(e.target.value)}
              placeholder="Paste the Reel's transcript, captions, or describe the content..."
              rows={8}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none" />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg p-3">
              <AlertCircle size={16} /> {error}
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={() => { setStep('url'); setError(''); setTranscript('') }}
              className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors flex items-center gap-2">
              <RotateCcw size={14} /> Back
            </button>
            <button onClick={handleProcess} disabled={step === 'processing' || !transcript.trim()}
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center justify-center gap-2">
              {step === 'processing' ? <><Loader2 size={16} className="animate-spin" /> {progress}</> : <><Sparkles size={16} /> Analyze with AI</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
