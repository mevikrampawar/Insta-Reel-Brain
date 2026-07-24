import { useState } from 'react'
import { Globe, Bot, CheckCircle2, XCircle, Loader2, ArrowRight, Zap, AlertCircle } from 'lucide-react'
import { fetchInstagramMetadata, validateWorkerUrl } from '../services/instagram'
import { fetchViaApify } from '../services/apify'

interface Props {
  workerUrl: string
  apifyApiKey: string
  groqApiKey: string
}

interface SourceStatus {
  name: string
  icon: typeof Globe
  configured: boolean
  testing: boolean
  tested: boolean
  working: boolean
  fields: string[]
  cost: string
  color: string
}

export function DataSources({ workerUrl, apifyApiKey, groqApiKey }: Props) {
  const [sources, setSources] = useState<SourceStatus[]>([
    {
      name: 'GraphQL (Cloudflare Worker)',
      icon: Globe,
      configured: !!workerUrl,
      testing: false,
      tested: false,
      working: false,
      fields: ['creator', 'caption', 'hashtags', 'thumbnail', 'video_url', 'likes', 'comments', 'duration'],
      cost: 'FREE',
      color: 'cyan',
    },
    {
      name: 'Apify Instagram Scraper',
      icon: Bot,
      configured: !!apifyApiKey,
      testing: false,
      tested: false,
      working: false,
      fields: ['creator', 'caption', 'hashtags', 'thumbnail', 'likes', 'comments', 'duration', 'transcript'],
      cost: 'PAID ($5 free credit)',
      color: 'orange',
    },
    {
      name: 'Groq AI Analysis',
      icon: Zap,
      configured: !!groqApiKey,
      testing: false,
      tested: false,
      working: false,
      fields: ['summary', 'key_takeaways', 'tags', 'concepts', 'action_items', 'embeddings'],
      cost: 'FREE (30 RPM)',
      color: 'indigo',
    },
  ])

  const [testResults, setTestResults] = useState<string[]>([])

  const handleTestAll = async () => {
    setTestResults([])
    const testUrl = 'https://www.instagram.com/reel/DLbXjKNTu4b/'
    const newSources = [...sources]
    const results: string[] = []

    // Test GraphQL Worker
    if (workerUrl) {
      const idx = newSources.findIndex(s => s.name.includes('GraphQL'))
      newSources[idx] = { ...newSources[idx], testing: true }
      setSources([...newSources])

      const validation = validateWorkerUrl(workerUrl)
      if (!validation.valid) {
        newSources[idx] = { ...newSources[idx], testing: false, tested: true, working: false }
        results.push(`GraphQL: ${validation.error}`)
      } else {
        try {
          const { metadata, sources: src } = await fetchInstagramMetadata(testUrl, workerUrl)
          const worked = !!metadata?.creatorHandle
          newSources[idx] = { ...newSources[idx], testing: false, tested: true, working: worked }
          if (worked) results.push(`GraphQL: ✓ Working (${src[0]?.fields.length || 0} fields)`)
          else results.push('GraphQL: ✗ No data returned (worker may not be deployed correctly)')
        } catch (e) {
          newSources[idx] = { ...newSources[idx], testing: false, tested: true, working: false }
          results.push(`GraphQL: ✗ ${e instanceof Error ? e.message : 'Failed'}`)
        }
      }
      setSources([...newSources])
    }

    // Test Apify
    if (apifyApiKey) {
      const idx = newSources.findIndex(s => s.name.includes('Apify'))
      newSources[idx] = { ...newSources[idx], testing: true }
      setSources([...newSources])

      try {
        const { result, sources: src } = await fetchViaApify(apifyApiKey, testUrl)
        const worked = !!result?.creatorHandle
        newSources[idx] = { ...newSources[idx], testing: false, tested: true, working: worked }
        if (worked) results.push(`Apify: ✓ Working (${src[0]?.fields.length || 0} fields)`)
        else results.push('Apify: ✗ No data returned')
      } catch (e) {
        newSources[idx] = { ...newSources[idx], testing: false, tested: true, working: false }
        results.push(`Apify: ✗ ${e instanceof Error ? e.message : 'Failed'}`)
      }
      setSources([...newSources])
    }

    // Groq
    const groqIdx = newSources.findIndex(s => s.name.includes('Groq'))
    newSources[groqIdx] = { ...newSources[groqIdx], tested: true, working: !!groqApiKey }
    if (groqApiKey) results.push('Groq: ✓ Configured')
    else results.push('Groq: ✗ Not configured')

    setSources([...newSources])
    setTestResults(results)
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h2 className="text-xl font-bold">Data Sources</h2>
        <p className="text-sm text-zinc-500 mt-1">
          See which sources provide data for your Reels. Free sources first, Apify for transcripts.
        </p>
      </div>

      {/* Pipeline */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h3 className="text-sm font-medium text-zinc-300 mb-4">Data Pipeline</h3>
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <div className="px-3 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-cyan-400">
            <Globe size={12} className="inline mr-1" />
            GraphQL Worker (Free)
          </div>
          <ArrowRight size={12} className="text-zinc-600" />
          <div className="px-3 py-2 bg-orange-500/10 border border-orange-500/20 rounded-lg text-orange-400">
            <Bot size={12} className="inline mr-1" />
            Apify (Paid)
          </div>
          <ArrowRight size={12} className="text-zinc-600" />
          <div className="px-3 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
            <Zap size={12} className="inline mr-1" />
            Groq AI (Free)
          </div>
        </div>
        <p className="text-xs text-zinc-500 mt-3">
          GraphQL Worker fetches metadata (free). If no transcript found, Apify fetches it (paid). Then Groq analyzes everything (free).
        </p>
      </div>

      {/* Source cards */}
      <div className="space-y-3">
        {sources.map((source, i) => {
          const Icon = source.icon
          return (
            <div key={i} className={`bg-zinc-900 border rounded-xl p-4 ${
              source.tested && source.working ? 'border-emerald-500/30'
              : source.tested && !source.working ? 'border-red-500/20'
              : 'border-zinc-800'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-${source.color}-500/10`}>
                    <Icon size={16} className={`text-${source.color}-400`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-sm">{source.name}</h4>
                      {!source.configured && (
                        <span className="text-xs px-1.5 py-0.5 bg-zinc-800 text-zinc-500 rounded">Not configured</span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Fields: {source.fields.join(', ')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-1 rounded ${
                    source.cost === 'FREE' || source.cost.startsWith('FREE')
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-orange-500/10 text-orange-400'
                  }`}>
                    {source.cost}
                  </span>
                  {source.testing && <Loader2 size={14} className="animate-spin text-zinc-400" />}
                  {source.tested && source.working && <CheckCircle2 size={14} className="text-emerald-400" />}
                  {source.tested && !source.working && <XCircle size={14} className="text-red-400" />}
                  {!source.tested && !source.testing && (
                    <span className="text-xs text-zinc-600">Not tested</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Test button */}
      <button
        onClick={handleTestAll}
        disabled={sources.some(s => s.testing)}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
      >
        {sources.some(s => s.testing)
          ? <><Loader2 size={16} className="animate-spin" /> Testing sources...</>
          : <>Test All Sources</>
        }
      </button>

      {/* Test results */}
      {testResults.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-medium text-zinc-300">Test Results</h3>
          {testResults.map((r, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              {r.includes('✓') ? (
                <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle size={12} className="text-red-400 shrink-0" />
              )}
              <span className={r.includes('✓') ? 'text-zinc-300' : 'text-red-400'}>{r}</span>
            </div>
          ))}
          <div className="text-xs text-zinc-500 mt-2 pt-2 border-t border-zinc-800">
            <p>Free sources: {testResults.filter(r => r.includes('✓') && !r.includes('Apify')).length} / {testResults.length}</p>
            <p>Paid sources: {testResults.filter(r => r.includes('✓') && r.includes('Apify')).length}</p>
          </div>
        </div>
      )}

      {/* Setup guide */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-2">
        <h4 className="text-xs font-medium text-zinc-400">Quick Setup</h4>
        <ul className="text-xs text-zinc-500 space-y-1">
          <li>• <strong className="text-zinc-300">GraphQL Worker:</strong> dash.cloudflare.com → Workers → Create Application → paste worker/instagram-proxy.js → Deploy</li>
          <li>• <strong className="text-zinc-300">Apify:</strong> console.apify.com → free $5 credit → Settings → API Token</li>
          <li>• <strong className="text-zinc-300">Groq:</strong> console.groq.com → API Keys → Create (free)</li>
        </ul>
      </div>
    </div>
  )
}
