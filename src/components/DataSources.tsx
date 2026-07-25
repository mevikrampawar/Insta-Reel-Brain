import { useMemo } from 'react'
import { Bot, Zap, TrendingUp } from 'lucide-react'
import type { Reel } from '../types'

interface Props {
  reels: Reel[]
  apifyApiKey: string
  groqApiKey: string
}

export function DataSources({ reels, apifyApiKey, groqApiKey }: Props) {
  const completeReels = useMemo(() => reels.filter(r => r.ingestStatus === 'complete'), [reels])

  const stats = useMemo(() => {
    const allSources = completeReels.flatMap(r => r.dataSources || [])
    const freeFields = allSources.filter(s => s.cost === 'free' || s.cost === 'free-tier').reduce((n, s) => n + s.fields.length, 0)
    const paidFields = allSources.filter(s => s.cost === 'paid').reduce((n, s) => n + s.fields.length, 0)
    const totalFields = freeFields + paidFields

    return {
      totalReels: completeReels.length,
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
        <p className="text-sm text-zinc-500 mt-1">Where your reel data came from.</p>
      </div>

      {/* Configured */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <h3 className="text-sm font-medium text-zinc-300 mb-3">Configured</h3>
        <div className="flex items-center gap-3 text-xs flex-wrap">
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

      {/* Per-reel breakdown */}
      {stats.totalReels > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Per Reel</h3>
          <div className="space-y-2 max-h-96 overflow-auto">
            {completeReels.map(reel => {
              const reelSources = reel.dataSources || []
              const freeCount = reelSources.filter(s => s.cost === 'free' || s.cost === 'free-tier').reduce((n, s) => n + s.fields.length, 0)
              const paidCount = reelSources.filter(s => s.cost === 'paid').reduce((n, s) => n + s.fields.length, 0)
              const total = freeCount + paidCount

              return (
                <div key={reel.id} className="flex items-center gap-3 py-2 border-b border-zinc-800 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200 truncate">{reel.title || 'Untitled'}</p>
                    <p className="text-xs text-zinc-500">
                      {reelSources.map(s => (
                        <span key={s.source} className={`inline-flex items-center gap-1 mr-2 ${s.source === 'apify' ? 'text-orange-400' : 'text-indigo-400'}`}>
                          <Bot size={10} />
                          {s.source} ({s.fields.length})
                        </span>
                      ))}
                      {reelSources.length === 0 && <span className="text-zinc-600">No source data</span>}
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
          <p className="text-xs text-zinc-500 mt-1">Add a reel to see data sources.</p>
        </div>
      )}
    </div>
  )
}
