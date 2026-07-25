import { useState, useCallback, useRef } from 'react'
import { Link, Loader2, AlertCircle, Sparkles, CheckCircle2, Video, Globe, Bot, XCircle } from 'lucide-react'
import type { Reel, DataSourceRecord } from '../types'
import { processReel } from '../services/ingestion'
import { fetchInstagramMetadata, isInstagramUrl } from '../services/instagram'
import { fetchViaApify } from '../services/apify'

interface Props {
  userId: string
  addReel: (data: Partial<Reel>) => Promise<string | undefined>
  updateReel: (id: string, data: Partial<Reel>) => Promise<void>
  onDone: () => void
  apiKey: string
  workerUrl: string
  apifyApiKey: string
}

type Phase = 'idle' | 'fetching' | 'ready' | 'processing' | 'done' | 'error'

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

interface FetchLog {
  source: string
  status: 'ok' | 'fail' | 'skip'
  detail: string
}

export function IngestionForm({ addReel, updateReel, onDone, apiKey, workerUrl, apifyApiKey }: Props) {
  const [url, setUrl] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [fetched, setFetched] = useState<FetchedData | null>(null)
  const [sources, setSources] = useState<DataSourceRecord[]>([])
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')
  const [fetchLog, setFetchLog] = useState<FetchLog[]>([])
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentUrlRef = useRef('')

  const fetchAll = useCallback(async (targetUrl: string) => {
    if (currentUrlRef.current === targetUrl) return
    currentUrlRef.current = targetUrl
    setError('')
    setFetchLog([])

    let title = '', creatorHandle = '', caption = '', hashtags: string[] = []
    let thumbnailUrl = '', videoUrl = '', likeCount = 0, commentCount = 0, duration = 0, transcript = ''
    const allSources: DataSourceRecord[] = []
    const log: FetchLog[] = []

    setPhase('fetching')
    setProgress('Fetching reel data...')

    // ── 1. Try Apify first (most reliable) ──
    if (apifyApiKey) {
      log.push({ source: 'Apify', status: 'ok', detail: 'Starting...' })
      setFetchLog([...log])
      try {
        const { result, sources: apifySources } = await fetchViaApify(workerUrl || undefined, apifyApiKey, targetUrl)
        if (result) {
          creatorHandle = result.creatorHandle
          caption = result.caption
          hashtags = result.hashtags
          thumbnailUrl = result.thumbnailUrl
          videoUrl = result.videoUrl
          likeCount = result.likeCount
          commentCount = result.commentCount
          duration = result.duration
          transcript = result.transcript
          title = result.title
          allSources.push(...apifySources)
          log[log.length - 1] = { source: 'Apify', status: 'ok', detail: `Got ${apifySources[0]?.fields.length || 0} fields` }
        } else {
          log[log.length - 1] = { source: 'Apify', status: 'fail', detail: 'No data returned' }
        }
      } catch (e) {
        log[log.length - 1] = { source: 'Apify', status: 'fail', detail: e instanceof Error ? e.message : 'Failed' }
      }
      setFetchLog([...log])
    } else {
      log.push({ source: 'Apify', status: 'skip', detail: 'Not configured' })
      setFetchLog([...log])
    }

    // ── 2. Try Instagram GraphQL to supplement ──
    const needsMore = !creatorHandle || !thumbnailUrl || hashtags.length === 0
    if (needsMore) {
      log.push({ source: 'GraphQL', status: 'ok', detail: 'Starting...' })
      setFetchLog([...log])
      try {
        const { metadata, sources: gqlSources } = await fetchInstagramMetadata(targetUrl, workerUrl || undefined)
        if (metadata) {
          if (!creatorHandle && metadata.creatorHandle) creatorHandle = metadata.creatorHandle
          if (!caption && metadata.caption) caption = metadata.caption
          if (metadata.hashtags.length > 0 && hashtags.length === 0) hashtags = metadata.hashtags
          if (!thumbnailUrl && metadata.thumbnailUrl) thumbnailUrl = metadata.thumbnailUrl
          if (!videoUrl && metadata.videoUrl) videoUrl = metadata.videoUrl
          if (!likeCount && metadata.likeCount) likeCount = metadata.likeCount
          if (!commentCount && metadata.commentCount) commentCount = metadata.commentCount
          if (!duration && metadata.duration) duration = metadata.duration
          allSources.push(...gqlSources)
          log[log.length - 1] = { source: 'GraphQL', status: 'ok', detail: `Got ${gqlSources[0]?.fields.length || 0} fields` }
        } else {
          log[log.length - 1] = { source: 'GraphQL', status: 'fail', detail: 'Instagram blocked the request' }
        }
      } catch (e) {
        log[log.length - 1] = { source: 'GraphQL', status: 'fail', detail: e instanceof Error ? e.message : 'Failed' }
      }
      setFetchLog([...log])
    } else {
      log.push({ source: 'GraphQL', status: 'skip', detail: 'Already have data from Apify' })
      setFetchLog([...log])
    }

    // ── 3. Build result ──
    if (!title) {
      title = caption ? caption.split('\n')[0]?.slice(0, 120) || '' : `Reel by @${creatorHandle || 'unknown'}`
    }

    const data: FetchedData = {
      title, creatorHandle, caption, hashtags, thumbnailUrl, videoUrl,
      likeCount, commentCount, duration, transcript,
    }

    setFetched(data)
    setSources(allSources)
    setPhase(allSources.length > 0 ? 'ready' : 'error')
    if (allSources.length === 0) setError('Could not fetch reel data. Check your API keys in Settings.')
    currentUrlRef.current = ''
  }, [workerUrl, apifyApiKey])

  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl)
    setPhase('idle')
    setFetched(null)
    setSources([])
    setError('')
    setFetchLog([])
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
          Worker {hasWorker ? '✓' : '(not set)'}
        </span>
        <span className={`flex items-center gap-1 ${hasApify ? 'text-emerald-400' : 'text-zinc-500'}`}>
          {hasApify ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
          Apify {hasApify ? '✓' : '(not set)'}
        </span>
      </div>

      {!hasWorker && !hasApify && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-400">
          No data sources configured. Go to <strong>Settings</strong> to add Apify and/or Cloudflare Worker.
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
      {phase === 'fetching' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-indigo-400 bg-indigo-500/5 border border-indigo-500/20 rounded-lg p-3">
            <Loader2 size={14} className="animate-spin" />
            <span>{progress}</span>
          </div>
          {fetchLog.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-1.5">
              {fetchLog.map((entry, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  {entry.status === 'ok' && <CheckCircle2 size={10} className="text-emerald-400 shrink-0" />}
                  {entry.status === 'fail' && <XCircle size={10} className="text-red-400 shrink-0" />}
                  {entry.status === 'skip' && <AlertCircle size={10} className="text-zinc-500 shrink-0" />}
                  <span className={`font-medium ${entry.status === 'ok' ? 'text-emerald-400' : entry.status === 'fail' ? 'text-red-400' : 'text-zinc-500'}`}>
                    {entry.source}
                  </span>
                  <span className="text-zinc-500">{entry.detail}</span>
                </div>
              ))}
            </div>
          )}
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

      {/* Error */}
      {phase === 'error' && error && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg p-3">
            <AlertCircle size={16} /> {error}
          </div>
          {fetchLog.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-1.5">
              {fetchLog.map((entry, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  {entry.status === 'ok' && <CheckCircle2 size={10} className="text-emerald-400 shrink-0" />}
                  {entry.status === 'fail' && <XCircle size={10} className="text-red-400 shrink-0" />}
                  {entry.status === 'skip' && <AlertCircle size={10} className="text-zinc-500 shrink-0" />}
                  <span className={`font-medium ${entry.status === 'ok' ? 'text-emerald-400' : entry.status === 'fail' ? 'text-red-400' : 'text-zinc-500'}`}>
                    {entry.source}
                  </span>
                  <span className="text-zinc-500">{entry.detail}</span>
                </div>
              ))}
            </div>
          )}
          {/* Actionable fix steps */}
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-400 space-y-1">
            <p className="font-medium">How to fix:</p>
            {!hasWorker && <p>• Add an Apify key in <strong>Settings</strong> — this is the most reliable source</p>}
            {hasWorker && <p>• Your Cloudflare Worker may need redeployment — open your Worker in Cloudflare Dashboard, paste the code from <code>worker/instagram-proxy.js</code>, and Deploy</p>}
            {!hasApify && <p>• Add an Apify key in <strong>Settings</strong> for metadata + transcripts</p>}
          </div>
        </div>
      )}

      {/* Analyze button */}
      <button
        onClick={handleAnalyze}
        disabled={!fetched || phase === 'processing' || phase === 'done'}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
      >
        {phase === 'processing' && <><Loader2 size={16} className="animate-spin" /> {progress}</>}
        {phase === 'done' && <><CheckCircle2 size={16} /> Done!</>}
        {phase === 'ready' && <><Sparkles size={16} /> Analyze with AI</>}
        {(phase === 'idle' || phase === 'fetching') && <><Sparkles size={16} /> Paste a URL to start</>}
      </button>
    </div>
  )
}
