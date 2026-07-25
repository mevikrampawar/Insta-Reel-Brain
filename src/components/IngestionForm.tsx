import { useState, useCallback, useRef } from 'react'
import { Link, Loader2, AlertCircle, Sparkles, CheckCircle2, Video, Globe, Bot } from 'lucide-react'
import type { Reel } from '../types'
import { processReel } from '../services/ingestion'
import { fetchInstagramMetadata, isInstagramUrl } from '../services/instagram'
import { fetchViaApify } from '../services/apify'
import type { DataSourceInfo } from '../services/instagram'

interface Props {
  userId: string
  addReel: (data: Partial<Reel>) => Promise<string | undefined>
  updateReel: (id: string, data: Partial<Reel>) => Promise<void>
  onDone: () => void
  apiKey: string
  workerUrl: string
  apifyApiKey: string
}

type Phase = 'idle' | 'fetching-free' | 'fetching-apify' | 'ready' | 'processing' | 'done' | 'error'

interface FetchedData {
  title: string
  creatorHandle: string
  caption: string
  hashtags: string[]
  thumbnailUrl: string
  videoUrl: string
  likeCount: number
  commentCount: number
  duration: number
  transcript: string
}

export function IngestionForm({ addReel, updateReel, onDone, apiKey, workerUrl, apifyApiKey }: Props) {
  const [url, setUrl] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [fetched, setFetched] = useState<FetchedData | null>(null)
  const [sources, setSources] = useState<DataSourceInfo[]>([])
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentUrlRef = useRef('')

  const fetchAll = useCallback(async (targetUrl: string) => {
    if (currentUrlRef.current === targetUrl) return
    currentUrlRef.current = targetUrl
    setError('')

    let title = '', creatorHandle = '', caption = '', hashtags: string[] = []
    let thumbnailUrl = '', videoUrl = '', likeCount = 0, commentCount = 0, duration = 0, transcript = ''
    const allSources: DataSourceInfo[] = []

    if (workerUrl) {
      setPhase('fetching-free')
      try {
        const { metadata, sources } = await fetchInstagramMetadata(targetUrl, workerUrl)
        allSources.push(...sources)
        if (metadata) {
          title = metadata.title
          creatorHandle = metadata.creatorHandle
          caption = metadata.caption
          hashtags = metadata.hashtags
          thumbnailUrl = metadata.thumbnailUrl
          videoUrl = metadata.videoUrl
          likeCount = metadata.likeCount
          commentCount = metadata.commentCount
          duration = metadata.duration
        }
      } catch {
        // continue to apify
      }
    }

    const hasTranscript = caption.length > 20
    if (!hasTranscript && apifyApiKey) {
      setPhase('fetching-apify')
      try {
        const { result, sources } = await fetchViaApify(workerUrl, apifyApiKey, targetUrl)
        allSources.push(...sources)
        if (result) {
          if (!creatorHandle && result.creatorHandle) creatorHandle = result.creatorHandle
          if (!caption && result.caption) caption = result.caption
          if (result.hashtags.length > 0 && hashtags.length === 0) hashtags = result.hashtags
          if (!thumbnailUrl && result.thumbnailUrl) thumbnailUrl = result.thumbnailUrl
          if (!videoUrl && result.videoUrl) videoUrl = result.videoUrl
          if (!likeCount && result.likeCount) likeCount = result.likeCount
          if (!commentCount && result.commentCount) commentCount = result.commentCount
          if (!duration && result.duration) duration = result.duration
          transcript = result.transcript
          if (result.title && !title) title = result.title
        }
      } catch {
        // continue
      }
    }

    if (!title) {
      title = caption ? caption.split('\n')[0]?.slice(0, 120) || '' : `Reel by @${creatorHandle || 'unknown'}`
    }

    const data: FetchedData = {
      title, creatorHandle, caption, hashtags, thumbnailUrl, videoUrl,
      likeCount, commentCount, duration, transcript,
    }

    setFetched(data)
    setSources(allSources)
    setPhase('ready')
    currentUrlRef.current = ''
  }, [workerUrl, apifyApiKey])

  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl)
    setPhase('idle')
    setFetched(null)
    setSources([])
    setError('')
    currentUrlRef.current = ''

    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current)

    if (isInstagramUrl(newUrl) && newUrl.length > 30) {
      fetchTimeoutRef.current = setTimeout(() => fetchAll(newUrl), 1000)
    }
  }

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

  const handleAnalyze = async () => {
    if (!fetched) return
    setPhase('processing')
    setProgress('Creating Reel entry...')

    try {
      const id = await addReel({
        url,
        title: fetched.title || 'Untitled Reel',
        creatorHandle: fetched.creatorHandle,
        caption: fetched.caption,
        hashtags: fetched.hashtags,
        thumbnailUrl: fetched.thumbnailUrl,
        dataSources: [
          ...sources,
          { source: 'groq' as const, fields: ['summary', 'keyTakeaways', 'suggestedTags', 'concepts', 'embeddings'], cost: 'free' as const, timestamp: Date.now() },
        ],
      })
      if (!id) throw new Error('Failed to create reel')

      const transcriptText = fetched.transcript || fetched.caption || ''

      await processReel(
        apiKey,
        {
          url,
          transcript: transcriptText,
          title: fetched.title,
          creatorHandle: fetched.creatorHandle,
          caption: fetched.caption,
          hashtags: fetched.hashtags,
          thumbnailUrl: fetched.thumbnailUrl,
        },
        id,
        updateReel,
        setProgress,
      )

      setPhase('done')
      setTimeout(onDone, 1500)
    } catch (e) {
      setPhase('error')
      setError(e instanceof Error ? e.message : 'Processing failed')
    }
  }

  const hasWorker = !!workerUrl.trim()
  const hasApify = !!apifyApiKey.trim()

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
          <Video size={20} />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Add Reel</h2>
          <p className="text-sm text-zinc-500">Paste the link — AI handles everything</p>
        </div>
      </div>

      {/* Config status */}
      <div className="flex items-center gap-3 text-xs">
        <span className={`flex items-center gap-1 ${hasWorker ? 'text-emerald-400' : 'text-zinc-500'}`}>
          {hasWorker ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
          GraphQL Worker {hasWorker ? '✓' : '(not set)'}
        </span>
        <span className={`flex items-center gap-1 ${hasApify ? 'text-emerald-400' : 'text-zinc-500'}`}>
          {hasApify ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
          Apify {hasApify ? '✓' : '(not set)'}
        </span>
      </div>

      {!hasWorker && !hasApify && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-400">
          No data sources configured. Go to <strong>Settings</strong> to add a Cloudflare Worker and/or Apify key for auto-fetch.
        </div>
      )}

      {/* URL Input */}
      <div>
        <label className="block text-sm text-zinc-400 mb-1">Instagram Reel URL</label>
        <div className="relative">
          <Link size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={url}
            onChange={e => handleUrlChange(e.target.value)}
            placeholder="https://www.instagram.com/reel/..."
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      {/* Fetching status */}
      {phase === 'fetching-free' && (
        <div className="flex items-center gap-2 text-sm text-cyan-400 bg-cyan-500/5 border border-cyan-500/20 rounded-lg p-3">
          <Loader2 size={14} className="animate-spin" />
          <span>Fetching metadata from Cloudflare Worker...</span>
        </div>
      )}

      {phase === 'fetching-apify' && (
        <div className="flex items-center gap-2 text-sm text-orange-400 bg-orange-500/5 border border-orange-500/20 rounded-lg p-3">
          <Loader2 size={14} className="animate-spin" />
          <span>Fetching transcript from Apify (~30s)...</span>
        </div>
      )}

      {/* Fetched results */}
      {phase === 'ready' && fetched && (
        <div className="space-y-3">
          {/* Source badges */}
          {sources.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {sources.map((s, i) => (
                <div key={i} className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs ${
                  s.cost === 'free'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                }`}>
                  {s.source === 'graphql' ? <Globe size={10} /> : <Bot size={10} />}
                  <span className="font-medium">{s.source}</span>
                  <span className="text-zinc-500">·</span>
                  <span>{s.fields.length} fields</span>
                  {s.cost === 'free' ? <span className="text-emerald-600">FREE</span> : <span className="text-orange-600">PAID</span>}
                </div>
              ))}
            </div>
          )}

          {sources.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
              <AlertCircle size={12} />
              <span>No metadata fetched. Add a Cloudflare Worker or Apify key in Settings.</span>
            </div>
          )}

          {/* Fetched data preview */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Fetched Data</h3>

            {fetched.thumbnailUrl && (
              <img src={fetched.thumbnailUrl} alt="" className="w-24 h-24 rounded-lg object-cover" />
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              {fetched.title && (
                <div className="col-span-2">
                  <p className="text-xs text-zinc-500">Title</p>
                  <p className="text-zinc-200">{fetched.title}</p>
                </div>
              )}
              {fetched.creatorHandle && (
                <div>
                  <p className="text-xs text-zinc-500">Creator</p>
                  <p className="text-zinc-200">@{fetched.creatorHandle}</p>
                </div>
              )}
              {fetched.likeCount > 0 && (
                <div>
                  <p className="text-xs text-zinc-500">Likes</p>
                  <p className="text-zinc-200">{fetched.likeCount.toLocaleString()}</p>
                </div>
              )}
              {fetched.duration > 0 && (
                <div>
                  <p className="text-xs text-zinc-500">Duration</p>
                  <p className="text-zinc-200">{Math.round(fetched.duration)}s</p>
                </div>
              )}
              {fetched.commentCount > 0 && (
                <div>
                  <p className="text-xs text-zinc-500">Comments</p>
                  <p className="text-zinc-200">{fetched.commentCount.toLocaleString()}</p>
                </div>
              )}
            </div>

            {fetched.hashtags.length > 0 && (
              <div>
                <p className="text-xs text-zinc-500 mb-1">Hashtags</p>
                <div className="flex flex-wrap gap-1">
                  {fetched.hashtags.map(h => (
                    <span key={h} className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded text-xs">#{h}</span>
                  ))}
                </div>
              </div>
            )}

            {fetched.caption && (
              <div>
                <p className="text-xs text-zinc-500 mb-1">Caption</p>
                <p className="text-zinc-300 text-xs leading-relaxed whitespace-pre-wrap">{fetched.caption}</p>
              </div>
            )}

            {fetched.transcript && (
              <div>
                <p className="text-xs text-zinc-500 mb-1">Transcript</p>
                <p className="text-zinc-300 text-xs leading-relaxed whitespace-pre-wrap max-h-32 overflow-auto">{fetched.transcript}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg p-3">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <button
        onClick={handleAnalyze}
        disabled={!fetched || phase === 'processing' || phase === 'done'}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
      >
        {phase === 'processing' && <><Loader2 size={16} className="animate-spin" /> {progress}</>}
        {phase === 'done' && <><CheckCircle2 size={16} /> Done!</>}
        {phase === 'ready' && <><Sparkles size={16} /> Analyze with AI</>}
        {(phase === 'idle' || phase === 'fetching-free' || phase === 'fetching-apify') && <><Sparkles size={16} /> Paste a URL to start</>}
      </button>
    </div>
  )
}
