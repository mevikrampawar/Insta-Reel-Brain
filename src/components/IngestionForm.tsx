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

const phaseConfig: Record<JobPhase, { icon: typeof Loader2; color: string; bg: string; label: string }> = {
  queued: { icon: Clock, color: 'text-zinc-400', bg: 'bg-zinc-500/10 border-zinc-500/20', label: 'Queued' },
  scraping: { icon: Loader2, color: 'text-orange-400', bg: 'bg-orange-500/5 border-orange-500/20', label: 'Scraping reel...' },
  scraped: { icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-500/5 border-blue-500/20', label: 'Fetching data...' },
  analyzing: { icon: Loader2, color: 'text-purple-400', bg: 'bg-purple-500/5 border-purple-500/20', label: 'Analyzing with AI...' },
  complete: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/5 border-emerald-500/20', label: 'Done!' },
  failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', label: 'Failed' },
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit()
  }

  if (!apiKey) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6 text-center space-y-3">
          <AlertCircle className="mx-auto text-amber-400" size={32} />
          <h3 className="font-medium text-amber-300">Groq API Key Required</h3>
          <p className="text-sm text-zinc-400">Go to <strong>Settings</strong> and add your free Groq API key.</p>
          <p className="text-xs text-zinc-500">Free at <a href="https://console.groq.com" target="_blank" rel="noopener" className="text-indigo-400 underline">console.groq.com</a></p>
        </div>
      </div>
    )
  }

  const activeJobs = jobs.filter(j => j.phase !== 'complete')
  const completedJobs = jobs.filter(j => j.phase === 'complete')

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center"><Video size={20} /></div>
        <div><h2 className="text-2xl font-bold">Add Reel</h2><p className="text-sm text-zinc-500">Paste URLs — AI handles everything in the background</p></div>
      </div>

      <div className="flex items-center gap-3 text-xs">
        <span className={`flex items-center gap-1 ${hasApify ? 'text-emerald-400' : 'text-amber-400'}`}>
          {hasApify ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />} Apify {hasApify ? 'connected' : '(not set)'}
        </span>
      </div>

      {!hasApify && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-400">
          Go to <strong>Settings</strong> → add your Apify API key. Free at <a href="https://console.apify.com" target="_blank" rel="noopener" className="underline">console.apify.com</a>
        </div>
      )}

      <div>
        <label className="block text-sm text-zinc-400 mb-1">Instagram Reel URL</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="https://www.instagram.com/reel/..."
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={!url.trim() || !hasApify}
            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
          >
            <ArrowRight size={16} /> Scrape
          </button>
        </div>
      </div>

      {activeJobs.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Processing ({activeJobs.length})</h3>
          {activeJobs.map(job => {
            const config = phaseConfig[job.phase]
            const Icon = config.icon
            return (
              <div key={job.id} className={`flex items-center gap-3 p-3 rounded-lg border ${config.bg}`}>
                <Icon size={14} className={`${config.color} ${job.phase === 'scraping' || job.phase === 'scraped' || job.phase === 'analyzing' ? 'animate-spin' : ''}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${config.color}`}>{config.label}</p>
                  <p className="text-xs text-zinc-500 truncate">{job.url}</p>
                  {job.error && <p className="text-xs text-red-400 mt-1">{job.error}</p>}
                </div>
                {job.phase === 'failed' && (
                  <button onClick={() => { addJob(job.url); removeJob(job.id) }} className="text-xs text-zinc-400 hover:text-white flex items-center gap-1">
                    <RefreshCw size={12} /> Retry
                  </button>
                )}
                <button onClick={() => removeJob(job.id)} className="text-zinc-600 hover:text-zinc-400">
                  <XCircle size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {completedJobs.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-emerald-400/60 uppercase tracking-wide">Completed ({completedJobs.length})</h3>
          {completedJobs.map(job => (
            <div key={job.id} className="flex items-center gap-3 p-3 rounded-lg border bg-emerald-500/5 border-emerald-500/20">
              <CheckCircle2 size={14} className="text-emerald-400" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-emerald-400">Done!</p>
                <p className="text-xs text-zinc-500 truncate">{job.url}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {jobs.length === 0 && (
        <div className="text-center py-12 text-zinc-600">
          <Video size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Paste a reel URL above to get started</p>
          <p className="text-xs mt-1 text-zinc-700">You can add multiple URLs — they process in parallel</p>
        </div>
      )}

      {completedJobs.length > 0 && (
        <button
          onClick={onSwitchToLibrary}
          className="w-full py-3 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 rounded-lg font-medium text-sm text-emerald-400 transition-colors flex items-center justify-center gap-2"
        >
          <Sparkles size={16} /> View in Library
        </button>
      )}
    </div>
  )
}
