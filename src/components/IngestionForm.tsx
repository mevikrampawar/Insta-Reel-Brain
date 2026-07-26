import { useState, useCallback, useEffect } from 'react'
import { Link, Loader2, AlertCircle, Sparkles, CheckCircle2, Video, XCircle, RefreshCw, Clock, ArrowRight, Clipboard, Settings, ExternalLink, Smartphone } from 'lucide-react'
import type { ScrapeJob, JobPhase } from '../hooks/useScrapeQueue'

interface Props {
  jobs: ScrapeJob[]
  addJob: (url: string) => void
  removeJob: (id: string) => void
  apiKey: string
  apifyApiKey: string
  onSwitchToLibrary: () => void
  clipboardUrl?: string | null
  onDismissClipboard?: () => void
  masterUsageCount?: number
  masterUsageLimit?: number
  needsMasterApify?: boolean
  hasOwnApifyKey?: boolean
  canUseMasterKey?: boolean
  onGoToSettings?: () => void
  existingReelUrls?: string[]
}

const phaseUI: Record<JobPhase, { icon: typeof Loader2; color: string; label: string }> = {
  queued: { icon: Clock, color: 'text-zinc-500', label: 'Queued' },
  scraping: { icon: Loader2, color: 'text-orange-400', label: 'Scraping reel...' },
  analyzing: { icon: Loader2, color: 'text-purple-400', label: 'Analyzing with AI...' },
  complete: { icon: CheckCircle2, color: 'text-emerald-400', label: 'Done' },
  failed: { icon: XCircle, color: 'text-red-400', label: 'Failed' },
}

function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim())
    // Strip query params & trailing slash for dedup (Instagram URLs have tracking params)
    return u.origin + u.pathname.replace(/\/+$/, '')
  } catch {
    return raw.trim()
  }
}

function shortUrl(url: string) {
  try {
    const u = new URL(url)
    const parts = u.pathname.split('/').filter(Boolean)
    return parts.length >= 2 ? `/${parts[0]}/${parts[1]}` : u.pathname
  } catch { return url.slice(0, 40) }
}

export function IngestionForm({ jobs, addJob, removeJob, apiKey, apifyApiKey, onSwitchToLibrary, clipboardUrl, onDismissClipboard, masterUsageCount = 0, masterUsageLimit = 5, needsMasterApify = false, hasOwnApifyKey = false, canUseMasterKey = true, onGoToSettings, existingReelUrls = [] }: Props) {
  const [url, setUrl] = useState('')
  const [duplicateMsg, setDuplicateMsg] = useState<string | null>(null)
  const hasApify = !!apifyApiKey.trim()
  const freeRemaining = Math.max(0, masterUsageLimit - masterUsageCount)
  const limitReached = needsMasterApify && !hasOwnApifyKey && !canUseMasterKey

  useEffect(() => {
    if (clipboardUrl && !url) setUrl(clipboardUrl)
  }, [clipboardUrl, url])

  // Clear duplicate message after 3s
  useEffect(() => {
    if (!duplicateMsg) return
    const t = setTimeout(() => setDuplicateMsg(null), 3000)
    return () => clearTimeout(t)
  }, [duplicateMsg])

  const handleSubmit = useCallback(() => {
    const trimmed = url.trim()
    if (!trimmed) return
    const normalized = normalizeUrl(trimmed)

    // Check if URL is already in the library (existing reel)
    if (existingReelUrls.some(u => normalizeUrl(u) === normalized)) {
      setDuplicateMsg('This reel is already in your library')
      return
    }

    // Check if URL is already in the active queue
    if (jobs.some(j => normalizeUrl(j.url) === normalized && j.phase !== 'failed')) {
      setDuplicateMsg('This URL is already being processed')
      return
    }

    addJob(trimmed)
    setUrl('')
    setDuplicateMsg(null)
  }, [url, addJob, jobs, existingReelUrls])

  if (!apiKey) {
    return (
      <div className="max-w-2xl mx-auto p-4 md:p-8">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6 text-center space-y-3">
          <AlertCircle className="mx-auto text-amber-400" size={32} />
          <h3 className="font-medium text-amber-300">Groq API Key Required</h3>
          <p className="text-sm text-zinc-400">Go to <strong>Settings</strong> and add your free Groq API key.</p>
        </div>
      </div>
    )
  }

  const activeJobs = jobs.filter(j => j.phase !== 'complete')
  const doneCount = jobs.filter(j => j.phase === 'complete').length

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center"><Video size={20} /></div>
          <div>
            <h2 className="text-2xl font-bold">Add Reel</h2>
            <p className="text-sm text-zinc-500">Paste a URL — AI handles everything</p>
          </div>
        </div>
        {doneCount > 0 && (
          <button onClick={onSwitchToLibrary} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 rounded-lg text-xs font-medium text-emerald-400 transition-colors">
            <Sparkles size={14} /> Library <span className="ml-1 bg-emerald-500/20 px-1.5 py-0.5 rounded">{doneCount}</span>
          </button>
        )}
      </div>

      {/* Free tier usage banner */}
      {needsMasterApify && !hasOwnApifyKey && (
        <div className={`rounded-xl p-3 flex items-center gap-3 text-xs ${limitReached ? 'bg-amber-500/10 border border-amber-500/20' : freeRemaining <= 2 ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-indigo-500/10 border border-indigo-500/20'}`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${limitReached ? 'bg-amber-500/20' : freeRemaining <= 2 ? 'bg-amber-500/20' : 'bg-indigo-500/20'}`}>
            {limitReached ? <AlertCircle size={14} className="text-amber-400" /> : <Sparkles size={14} className="text-indigo-400" />}
          </div>
          <div className="flex-1 min-w-0">
            {limitReached ? (
              <p className="text-amber-300">
                <span className="font-medium">Free trial used up ({masterUsageLimit} reels).</span>
                <span className="text-zinc-500"> Add your own API keys to continue — both are free to get.</span>
              </p>
            ) : freeRemaining > 0 ? (
              <p className={freeRemaining <= 2 ? 'text-amber-300' : 'text-indigo-300'}>
                <span className="font-medium">{freeRemaining} free reel{freeRemaining !== 1 ? 's' : ''} remaining</span>
                <span className="text-zinc-500"> — add your own Apify key for unlimited scraping</span>
              </p>
            ) : null}
          </div>
          {onGoToSettings && (
            <button onClick={onGoToSettings} className="flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-zinc-300 shrink-0 transition-colors">
              <Settings size={12} /> {limitReached ? 'Add Keys' : 'Keys'}
            </button>
          )}
        </div>
      )}

      {/* Duplicate URL warning */}
      {duplicateMsg && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center gap-3 text-xs">
          <AlertCircle size={14} className="text-amber-400 shrink-0" />
          <p className="text-amber-300">{duplicateMsg}</p>
        </div>
      )}

      {/* Clipboard detection banner */}
      {clipboardUrl && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
            <Clipboard size={14} className="text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-emerald-300">Instagram link detected in clipboard</p>
            <p className="text-[10px] text-zinc-500 truncate">{clipboardUrl}</p>
          </div>
          <button onClick={() => { addJob(clipboardUrl); onDismissClipboard?.(); setUrl('') }} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-medium text-white shrink-0 transition-colors">
            Add it
          </button>
          <button onClick={onDismissClipboard} className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors">
            <XCircle size={14} />
          </button>
        </div>
      )}

      {!hasApify && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-400">
          Add Apify API key in <strong>Settings</strong> to scrape reels.
        </div>
      )}

      {/* How to add from iPhone — shown to new users */}
      {jobs.length === 0 && activeJobs.length === 0 && (
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
          <p className="text-xs font-medium text-zinc-300 mb-2">Quick ways to add reels:</p>
          <div className="space-y-2">
            <div className="flex items-start gap-2.5">
              <Smartphone size={14} className="text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-zinc-300"><span className="font-medium">iPhone:</span> Copy a reel link from Instagram, then paste it here (or tap "Add it" above)</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Link size={14} className="text-purple-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-zinc-300"><span className="font-medium">Any device:</span> Paste an Instagram reel URL in the box below</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <ExternalLink size={14} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-zinc-300"><span className="font-medium">iOS Shortcut:</span> Set up the "Add to Reel Brain" shortcut to share directly from Instagram</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="https://www.instagram.com/reel/..."
            aria-label="Instagram Reel URL"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-10 pr-4 min-h-[48px] text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={!url.trim() || !hasApify || limitReached}
          aria-label="Submit URL"
          className="min-w-[48px] min-h-[48px] flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-medium text-sm transition-colors"
        >
          <ArrowRight size={16} />
        </button>
      </div>

      {activeJobs.length > 0 && (
        <div className="space-y-1.5">
          {activeJobs.map(job => {
            const ui = phaseUI[job.phase]
            const Icon = ui.icon
            const spinning = job.phase === 'scraping' || job.phase === 'analyzing'
            return (
              <div key={job.id} className="flex items-center gap-3 px-4 min-h-[48px] bg-zinc-900 border border-zinc-800 rounded-lg">
                <Icon size={14} className={`${ui.color} ${spinning ? 'animate-spin' : ''}`} />
                <span className={`text-sm ${ui.color}`}>{ui.label}</span>
                <span className="text-xs text-zinc-600 truncate flex-1">{shortUrl(job.url)}</span>
                {job.phase === 'failed' && job.error && (
                  <span className="text-[10px] text-red-400/80 max-w-[180px] truncate" title={job.error}>{job.error}</span>
                )}
                {job.phase === 'failed' && (
                  <button onClick={() => { addJob(job.url); removeJob(job.id) }} className="min-w-[36px] min-h-[36px] flex items-center justify-center text-xs text-zinc-500 hover:text-white">
                    <RefreshCw size={11} />
                  </button>
                )}
                <button onClick={() => removeJob(job.id)} className="min-w-[36px] min-h-[36px] flex items-center justify-center text-zinc-700 hover:text-zinc-400">
                  <XCircle size={13} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {jobs.length === 0 && (
        <div className="text-center py-12 text-zinc-600">
          <Video size={36} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">Paste a reel URL above to get started</p>
          <p className="text-xs mt-1 text-zinc-700">Add multiple URLs — they process in parallel</p>
        </div>
      )}
    </div>
  )
}
