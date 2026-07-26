import { useState, useCallback } from 'react'
import { Link, Loader2, AlertCircle, Sparkles, CheckCircle2, Video, XCircle, RefreshCw, Clock, ArrowRight } from 'lucide-react'
import type { ScrapeJob, JobPhase } from '../hooks/useScrapeQueue'

interface Props {
  jobs: ScrapeJob[]
  addJob: (url: string) => void
  removeJob: (id: string) => void
  apiKey: string
  apifyApiKey: string
  onSwitchToLibrary: () => void
}

const phaseUI: Record<JobPhase, { icon: typeof Loader2; color: string; label: string }> = {
  queued: { icon: Clock, color: 'text-zinc-500', label: 'Queued' },
  scraping: { icon: Loader2, color: 'text-orange-400', label: 'Scraping reel...' },
  analyzing: { icon: Loader2, color: 'text-purple-400', label: 'Analyzing with AI...' },
  complete: { icon: CheckCircle2, color: 'text-emerald-400', label: 'Done' },
  failed: { icon: XCircle, color: 'text-red-400', label: 'Failed' },
}

function shortUrl(url: string) {
  try {
    const u = new URL(url)
    const parts = u.pathname.split('/').filter(Boolean)
    return parts.length >= 2 ? `/${parts[0]}/${parts[1]}` : u.pathname
  } catch { return url.slice(0, 40) }
}

export function IngestionForm({ jobs, addJob, removeJob, apiKey, apifyApiKey, onSwitchToLibrary }: Props) {
  const [url, setUrl] = useState('')
  const hasApify = !!apifyApiKey.trim()

  const handleSubmit = useCallback(() => {
    const trimmed = url.trim()
    if (!trimmed) return
    addJob(trimmed)
    setUrl('')
  }, [url, addJob])

  if (!apiKey) {
    return (
      <div className="max-w-2xl mx-auto p-8">
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
    <div className="max-w-2xl mx-auto p-8 space-y-6">
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

      {!hasApify && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-400">
          Add Apify API key in <strong>Settings</strong> to scrape reels.
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
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={!url.trim() || !hasApify}
          className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
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
              <div key={job.id} className="flex items-center gap-3 px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg">
                <Icon size={14} className={`${ui.color} ${spinning ? 'animate-spin' : ''}`} />
                <span className={`text-sm ${ui.color}`}>{ui.label}</span>
                <span className="text-xs text-zinc-600 truncate flex-1">{shortUrl(job.url)}</span>
                {job.phase === 'failed' && (
                  <button onClick={() => { addJob(job.url); removeJob(job.id) }} className="text-xs text-zinc-500 hover:text-white flex items-center gap-1">
                    <RefreshCw size={11} /> Retry
                  </button>
                )}
                <button onClick={() => removeJob(job.id)} className="text-zinc-700 hover:text-zinc-400">
                  <XCircle size={13} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {jobs.length === 0 && (
        <div className="text-center py-16 text-zinc-600">
          <Video size={36} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">Paste a reel URL above to get started</p>
          <p className="text-xs mt-1 text-zinc-700">Add multiple URLs — they process in parallel</p>
        </div>
      )}
    </div>
  )
}
