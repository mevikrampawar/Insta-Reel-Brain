import { useState, useCallback, useEffect } from 'react'
import { motion } from 'motion/react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { Link, AlertCircle, CheckCircle2, Video, XCircle, RotateCw, ArrowRight, Clipboard, Settings, ExternalLink, Smartphone, Loader2 } from 'lucide-react'
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

const phaseUI: Record<JobPhase, { badgeVariant: 'warning' | 'secondary' | 'destructive' | 'success' | 'default'; label: string; spinning: boolean }> = {
  queued: { badgeVariant: 'secondary', label: 'Queued', spinning: false },
  scraping: { badgeVariant: 'warning', label: 'Scraping', spinning: true },
  analyzing: { badgeVariant: 'secondary', label: 'Analyzing', spinning: true },
  complete: { badgeVariant: 'success', label: 'Done', spinning: false },
  failed: { badgeVariant: 'destructive', label: 'Failed', spinning: false },
}

function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim())
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
  const [tipsOpen, setTipsOpen] = useState(false)
  const hasApify = !!apifyApiKey.trim()
  const freeRemaining = Math.max(0, masterUsageLimit - masterUsageCount)
  const limitReached = needsMasterApify && !hasOwnApifyKey && !canUseMasterKey
  const usagePercent = Math.round((masterUsageCount / masterUsageLimit) * 100)

  useEffect(() => {
    if (clipboardUrl && !url) setUrl(clipboardUrl)
  }, [clipboardUrl, url])

  useEffect(() => {
    if (!duplicateMsg) return
    const t = setTimeout(() => setDuplicateMsg(null), 3000)
    return () => clearTimeout(t)
  }, [duplicateMsg])

  const handleSubmit = useCallback(() => {
    const trimmed = url.trim()
    if (!trimmed) return
    const normalized = normalizeUrl(trimmed)

    if (!/^https?:\/\/(?:www\.)?instagram\.com\/(?:reel|p)\/[\w-]+/.test(trimmed)) {
      setDuplicateMsg('Please enter a valid Instagram Reel URL')
      return
    }

    if (existingReelUrls.some(u => normalizeUrl(u) === normalized)) {
      setDuplicateMsg('This reel is already in your library')
      return
    }

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
        <Card className="bg-amber-500/10 border-amber-500/30 p-6 text-center space-y-3">
          <AlertCircle className="mx-auto text-amber-400" size={32} />
          <h3 className="font-medium text-amber-300">Groq API Key Required</h3>
          <p className="text-sm text-zinc-400">Go to <strong>Settings</strong> and add your free Groq API key.</p>
        </Card>
      </div>
    )
  }

  const activeJobs = jobs.filter(j => j.phase !== 'complete')
  const doneCount = jobs.filter(j => j.phase === 'complete').length

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8 space-y-6" data-tour="ingest">

      {/* Hero area */}
      <motion.div
        className="space-y-1"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Video size={20} />
              </div>
              Add Reel
            </h1>
            <p className="text-sm text-zinc-500 mt-1">Paste any Instagram reel URL</p>
          </div>
          {doneCount > 0 && (
            <Button variant="outline" size="sm" onClick={onSwitchToLibrary} className="gap-1.5 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10">
              <CheckCircle2 size={14} /> Library <Badge variant="success" className="ml-1 text-[10px]">{doneCount}</Badge>
            </Button>
          )}
        </div>
      </motion.div>

      {/* Clipboard detection banner */}
      {clipboardUrl && (
        <Card className="bg-emerald-500/10 border-emerald-500/20 p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
            <Clipboard size={14} className="text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-emerald-300">Instagram link detected</p>
            <p className="text-[10px] text-zinc-500 truncate">{clipboardUrl}</p>
          </div>
          <Button size="sm" onClick={() => { addJob(clipboardUrl); onDismissClipboard?.(); setUrl('') }}>
            Add it
          </Button>
          <button onClick={onDismissClipboard} className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors">
            <XCircle size={14} />
          </button>
        </Card>
      )}

      {/* Free tier meter */}
      {needsMasterApify && !hasOwnApifyKey && (
        <Card className={cn(
          'p-4 space-y-3',
          limitReached ? 'border-amber-500/30 bg-amber-500/10' : freeRemaining <= 2 ? 'border-amber-500/20 bg-amber-500/10' : 'bg-card'
        )}>
          <div className="flex items-center justify-between text-xs">
            <span className={cn(limitReached ? 'text-amber-300' : freeRemaining <= 2 ? 'text-amber-300' : 'text-zinc-400')}>
              {masterUsageCount} of {masterUsageLimit} free reels used
            </span>
            <span className="text-zinc-500">{freeRemaining} remaining</span>
          </div>
          <Progress value={usagePercent} className="h-2" />
          {limitReached && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-amber-300">Add your own API keys to continue</p>
              {onGoToSettings && (
                <Button variant="outline" size="sm" onClick={onGoToSettings} className="gap-1">
                  <Settings size={12} /> Add Keys
                </Button>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Duplicate URL warning */}
      {duplicateMsg && (
        <Card className="bg-amber-500/10 border-amber-500/20 p-3 flex items-center gap-3 text-xs">
          <AlertCircle size={14} className="text-amber-400 shrink-0" />
          <p className="text-amber-300">{duplicateMsg}</p>
        </Card>
      )}

      {/* URL input */}
      <div className="flex gap-2">
        <div className="relative flex-1" data-tour="url-input">
          <Link size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="https://www.instagram.com/reel/..."
            aria-label="Instagram Reel URL"
            className="h-14 pl-10 pr-4 rounded-xl text-base focus-visible:ring-indigo-500"
          />
        </div>
        <Button
          onClick={handleSubmit}
          disabled={!url.trim() || !hasApify || limitReached}
          aria-label="Submit URL"
          className="h-14 w-14 rounded-xl p-0"
        >
          <ArrowRight size={18} />
        </Button>
      </div>

      {/* Quick ways — collapsible */}
      {jobs.length === 0 && activeJobs.length === 0 && (
        <Card className="overflow-hidden">
          <button
            onClick={() => setTipsOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-xs text-zinc-300 hover:bg-white/[0.02] transition-colors"
          >
            <span className="font-medium">Quick ways to add reels</span>
            <span className="text-zinc-500">{tipsOpen ? '▾' : '▸'}</span>
          </button>
          {tipsOpen && (
            <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
              <div className="flex items-start gap-2.5">
                <Smartphone size={14} className="text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-zinc-300"><span className="font-medium">iPhone:</span> Copy a reel link from Instagram, then paste it here (or tap "Add it" above)</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Link size={14} className="text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-zinc-300"><span className="font-medium">Any device:</span> Paste an Instagram reel URL in the box above</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <ExternalLink size={14} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-zinc-300"><span className="font-medium">iOS Shortcut:</span> Tap to install, then share reels directly from Instagram</p>
                  <a href="/Insta-Reel-Brain/Add-to-Reel-Brain.shortcut" download
                    className="inline-flex items-center gap-1 mt-1.5 px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg text-[11px] font-medium text-amber-300 transition-colors">
                    <Smartphone size={10} /> Install Shortcut
                  </a>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Job queue */}
      {activeJobs.length > 0 && (
        <div className="space-y-2">
          {activeJobs.map(job => {
            const ui = phaseUI[job.phase]
            return (
              <Card key={job.id} className="p-3 flex items-center gap-3">
                <Badge variant={ui.badgeVariant} className="shrink-0">
                  {ui.spinning && <Loader2 size={10} className="animate-spin mr-1" />}
                  {ui.label}
                </Badge>
                <span className="text-xs text-zinc-500 truncate flex-1">{shortUrl(job.url)}</span>
                {job.phase === 'failed' && job.error && (
                  <span className="text-[10px] text-red-400/80 max-w-[180px] truncate" title={job.error}>{job.error}</span>
                )}
                {job.phase === 'failed' && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { addJob(job.url); removeJob(job.id) }}>
                    <RotateCw size={12} />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500" onClick={() => removeJob(job.id)}>
                  <XCircle size={13} />
                </Button>
              </Card>
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {jobs.length === 0 && activeJobs.length === 0 && (
        <div className="text-center py-12 text-zinc-600">
          <Video size={36} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">Paste a reel URL above to get started</p>
          <p className="text-xs mt-1 text-zinc-700">Add multiple URLs — they process in parallel</p>
        </div>
      )}
    </div>
  )
}


