import { useMemo } from 'react'
import { Globe, Bot, Zap, ExternalLink, TrendingUp } from 'lucide-react'
import type { Reel } from '../types'

interface Props {
  reels: Reel[]
  workerUrl: string
  apifyApiKey: string
  groqApiKey: string
}

const SOURCE_CONFIG = {
  graphql: { icon: Globe, label: 'GraphQL Worker', color: 'cyan', cost: 'FREE' },
  apify: { icon: Bot, label: 'Apify', color: 'orange', cost: 'PAID' },
  groq: { icon: Zap, label: 'Groq AI', color: 'indigo', cost: 'FREE' },
}

export function DataSources({ reels, workerUrl, apifyApiKey, groqApiKey }: Props) {
  const completeReels = useMemo(() => reels.filter(r => r.ingestStatus === 'complete'), [reels])

  const stats = useMemo(() => {
    const allSources = completeReels.flatMap(r => r.dataSources || [])
    const bySource = {
      graphql: allSources.filter(s => s.source === 'graphql'),
      apify: allSources.filter(s => s.source === 'apify'),
      groq: allSources.filter(s => s.source === 'groq'),
    }
    const freeFields = allSources.filter(s => s.cost === 'free').reduce((n, s) => n + s.fields.length, 0)
    const paidFields = allSources.filter(s => s.cost === 'paid').reduce((n, s) => n + s.fields.length, 0)
    const totalFields = freeFields + paidFields

    return {
      totalReels: completeReels.length,
      bySource,
      freeFields,
      paidFields,
      totalFields,
      freePercent: totalFields > 0 ? Math.round((freeFields / totalFields) * 100) : 0,
    }
  }, [completeReels])

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h2 className="text-xl font-bold">Data Sources</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Where your reel data came from. Free sources first, Apify for transcripts.
        </p>
      </div>

      {/* Config status */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <h3 className="text-sm font-medium text-zinc-300 mb-3">Configured Sources</h3>
        <div className="flex items-center gap-3 text-xs flex-wrap">
          <span className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${workerUrl ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-500 border border-zinc-700'}`}>
            <Globe size={10} /> GraphQL Worker {workerUrl ? '✓' : '—'}
          </span>
          <span className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${apifyApiKey ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-500 border border-zinc-700'}`}>
            <Bot size={10} /> Apify {apifyApiKey ? '✓' : '—'}
          </span>
          <span className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${groqApiKey ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-500 border border-zinc-700'}`}>
            <Zap size={10} /> Groq AI {groqApiKey ? '✓' : '—'}
          </span>
        </div>
      </div>

      {/* Stats */}
      {stats.totalReels > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{stats.freePercent}%</p>
            <p className="text-xs text-zinc-500 mt-1">Free Data</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-zinc-200">{stats.totalReels}</p>
            <p className="text-xs text-zinc-500 mt-1">Reels Analyzed</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-zinc-200">{stats.totalFields}</p>
            <p className="text-xs text-zinc-500 mt-1">Fields Extracted</p>
          </div>
        </div>
      )}

      {/* Pipeline */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <h3 className="text-sm font-medium text-zinc-300 mb-3">How It Works</h3>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-cyan-500/10 flex items-center justify-center shrink-0">
              <span className="text-cyan-400 font-bold">1</span>
            </div>
            <div>
              <span className="text-cyan-400 font-medium">GraphQL Worker</span>
              <span className="text-zinc-500"> — Fetches creator, caption, hashtags, video, likes (FREE)</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
              <span className="text-orange-400 font-bold">2</span>
            </div>
            <div>
              <span className="text-orange-400 font-medium">Apify</span>
              <span className="text-zinc-500"> — If no transcript, fetches it from Apify (PAID, ~$0.001/reel)</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0">
              <span className="text-indigo-400 font-bold">3</span>
            </div>
            <div>
              <span className="text-indigo-400 font-medium">Groq AI</span>
              <span className="text-zinc-500"> — Generates summary, tags, concepts, embeddings (FREE)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Per-reel breakdown */}
      {stats.totalReels > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Source Breakdown per Reel</h3>
          <div className="space-y-2 max-h-96 overflow-auto">
            {completeReels.map(reel => {
              const reelSources = reel.dataSources || []
              const freeCount = reelSources.filter(s => s.cost === 'free').reduce((n, s) => n + s.fields.length, 0)
              const paidCount = reelSources.filter(s => s.cost === 'paid').reduce((n, s) => n + s.fields.length, 0)
              const total = freeCount + paidCount

              return (
                <div key={reel.id} className="flex items-center gap-3 py-2 border-b border-zinc-800 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200 truncate">{reel.title || 'Untitled'}</p>
                    <p className="text-xs text-zinc-500">
                      {reelSources.map(s => {
                        const config = SOURCE_CONFIG[s.source]
                        const Icon = config.icon
                        return (
                          <span key={s.source} className={`inline-flex items-center gap-1 mr-2 text-${config.color}-400`}>
                            <Icon size={10} /> {config.label}
                            <span className="text-zinc-600">({s.fields.length})</span>
                          </span>
                        )
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {freeCount > 0 && (
                      <span className="text-xs px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded">
                        {freeCount} free
                      </span>
                    )}
                    {paidCount > 0 && (
                      <span className="text-xs px-1.5 py-0.5 bg-orange-500/10 text-orange-400 rounded">
                        {paidCount} paid
                      </span>
                    )}
                    <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${total > 0 ? (freeCount / total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {stats.totalReels === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
          <TrendingUp size={24} className="mx-auto text-zinc-600 mb-2" />
          <p className="text-sm text-zinc-400">No reels analyzed yet.</p>
          <p className="text-xs text-zinc-500 mt-1">Add a reel to see where data comes from.</p>
        </div>
      )}

      {/* Setup links */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-2">
        <h4 className="text-xs font-medium text-zinc-400">Setup</h4>
        <ul className="text-xs text-zinc-500 space-y-1">
          {!workerUrl && (
            <li>
              <a href="https://dash.cloudflare.com" target="_blank" rel="noopener"
                className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300">
                Cloudflare Worker <ExternalLink size={8} />
              </a>
              — Free, 2 min setup. Paste worker/instagram-proxy.js code.
            </li>
          )}
          {!apifyApiKey && (
            <li>
              <a href="https://console.apify.com" target="_blank" rel="noopener"
                className="inline-flex items-center gap-1 text-orange-400 hover:text-orange-300">
                Apify <ExternalLink size={8} />
              </a>
              — Free $5 credit (~3,300 reels). For transcript auto-fetch.
            </li>
          )}
          {!groqApiKey && (
            <li>
              <a href="https://console.groq.com" target="_blank" rel="noopener"
                className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300">
                Groq <ExternalLink size={8} />
              </a>
              — Free. For AI analysis, summary, tags, embeddings.
            </li>
          )}
          {workerUrl && apifyApiKey && groqApiKey && (
            <li className="text-emerald-400">All sources configured. You're good to go!</li>
          )}
        </ul>
      </div>
    </div>
  )
}
