import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Key, Save, Check, AlertCircle, ExternalLink, Trash2, Clock, Globe, CheckCircle2, Bot } from 'lucide-react'
import { db } from '../services/firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'

interface Props {
  userId: string
}

interface UserSettings {
  groqApiKey: string
  workerUrl: string
  apifyApiKey: string
  updatedAt: number
}

export function Settings({ userId }: Props) {
  const [apiKey, setApiKey] = useState('')
  const [workerUrl, setWorkerUrl] = useState('')
  const [apifyApiKey, setApifyApiKey] = useState('')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showKey, setShowKey] = useState(false)
  const [showApifyKey, setShowApifyKey] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  useEffect(() => {
    const load = async () => {
      const snap = await getDoc(doc(db, 'users', userId, 'settings', 'preferences'))
      if (snap.exists()) {
        const data = snap.data() as UserSettings
        setApiKey(data.groqApiKey || '')
        setWorkerUrl(data.workerUrl || '')
        setApifyApiKey(data.apifyApiKey || '')
        if (data.updatedAt) setLastSaved(new Date(data.updatedAt))
      }
      setLoading(false)
    }
    load()
  }, [userId])

  const handleSave = async () => {
    await setDoc(doc(db, 'users', userId, 'settings', 'preferences'), {
      groqApiKey: apiKey.trim(),
      workerUrl: workerUrl.trim(),
      apifyApiKey: apifyApiKey.trim(),
      updatedAt: Date.now(),
    })
    setSaved(true)
    setLastSaved(new Date())
    setTimeout(() => setSaved(false), 3000)
  }

  const handleClearKey = async (field: 'groq' | 'worker' | 'apify') => {
    if (field === 'groq') setApiKey('')
    if (field === 'worker') setWorkerUrl('')
    if (field === 'apify') setApifyApiKey('')
    await setDoc(doc(db, 'users', userId, 'settings', 'preferences'), {
      groqApiKey: (field === 'groq' ? '' : apiKey).trim(),
      workerUrl: (field === 'worker' ? '' : workerUrl).trim(),
      apifyApiKey: (field === 'apify' ? '' : apifyApiKey).trim(),
      updatedAt: Date.now(),
    })
    setSaved(true)
    setLastSaved(new Date())
    setTimeout(() => setSaved(false), 3000)
  }

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const hasChanges = apiKey.trim() !== '' || workerUrl.trim() !== '' || apifyApiKey.trim() !== ''

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center">
            <SettingsIcon size={20} className="text-zinc-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Settings</h2>
            <p className="text-sm text-zinc-500">Configure API keys and data sources</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {saved && lastSaved && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <CheckCircle2 size={12} />
              <span>Saved</span>
              <span className="text-zinc-600">·</span>
              <Clock size={10} className="text-zinc-500" />
              <span className="text-zinc-500">{formatTimeAgo(lastSaved)}</span>
            </div>
          )}
          {!saved && lastSaved && (
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <Clock size={10} />
              <span>Last saved {formatTimeAgo(lastSaved)}</span>
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
          >
            {saved ? <><Check size={14} /> Saved!</> : <><Save size={14} /> Save All</>}
          </button>
        </div>
      </div>

      {/* Groq API Key */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Key size={16} className="text-indigo-400" />
          <h3 className="font-medium">Groq API Key</h3>
          <span className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded">Free</span>
          {apiKey && <CheckCircle2 size={14} className="text-emerald-400 ml-auto" />}
        </div>
        <p className="text-sm text-zinc-400">
          For AI analysis, search embeddings, and chat. Stored securely in your Firestore account only.
        </p>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <a href="https://console.groq.com" target="_blank" rel="noopener"
            className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors">
            Get free API key <ExternalLink size={10} />
          </a>
          <span>→ Sign in → API Keys → Create</span>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="gsk_..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors font-mono"
            />
            <button onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-300">
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
          {apiKey && (
            <button onClick={() => handleClearKey('groq')}
              className="px-3 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-zinc-400 hover:text-red-400 transition-colors"
              title="Clear">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Apify API Key */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-orange-400" />
          <h3 className="font-medium">Apify API Key</h3>
          <span className="text-xs px-2 py-0.5 bg-orange-500/10 text-orange-400 rounded">$5 free credit</span>
          {apifyApiKey && <CheckCircle2 size={14} className="text-emerald-400 ml-auto" />}
        </div>
        <p className="text-sm text-zinc-400">
          Fetches reel transcripts, hashtags, captions, and more when free sources can't get everything.
          $5 free credit = ~3,300 reels. No credit card required.
        </p>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <a href="https://console.apify.com" target="_blank" rel="noopener"
            className="inline-flex items-center gap-1 text-orange-400 hover:text-orange-300 transition-colors">
            Get free API key <ExternalLink size={10} />
          </a>
          <span>→ Sign up → Settings → API Token</span>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={showApifyKey ? 'text' : 'password'}
              value={apifyApiKey}
              onChange={e => setApifyApiKey(e.target.value)}
              placeholder="apify_api_..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors font-mono"
            />
            <button onClick={() => setShowApifyKey(!showApifyKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-300">
              {showApifyKey ? 'Hide' : 'Show'}
            </button>
          </div>
          {apifyApiKey && (
            <button onClick={() => handleClearKey('apify')}
              className="px-3 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-zinc-400 hover:text-red-400 transition-colors"
              title="Clear">
              <Trash2 size={14} />
            </button>
          )}
        </div>
        {!apifyApiKey && (
          <div className="flex items-start gap-2 text-xs text-zinc-500 bg-zinc-800/50 border border-zinc-800 rounded-lg p-3">
            <AlertCircle size={12} className="shrink-0 mt-0.5" />
            <span>Optional. Without it, reels that can't be scraped by free sources will have incomplete metadata (no transcript auto-fill).</span>
          </div>
        )}
      </div>

      {/* Cloudflare Worker */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Globe size={16} className="text-cyan-400" />
          <h3 className="font-medium">Instagram Proxy (Cloudflare Worker)</h3>
          <span className="text-xs px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded">Optional</span>
          {workerUrl && <CheckCircle2 size={14} className="text-emerald-400 ml-auto" />}
        </div>
        <p className="text-sm text-zinc-400">
          Enables free GraphQL metadata fetch (creator, caption, hashtags, video URL).
          Requires a free Cloudflare Worker — takes 2 minutes to set up.
        </p>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <a href="https://dash.cloudflare.com" target="_blank" rel="noopener"
            className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors">
            Create free Cloudflare account <ExternalLink size={10} />
          </a>
          <span>→ Workers → Create → Paste worker code → Deploy</span>
        </div>
        <div className="flex gap-2">
          <input
            value={workerUrl}
            onChange={e => setWorkerUrl(e.target.value)}
            placeholder="https://ig-proxy.YOUR_SUBDOMAIN.workers.dev"
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors font-mono text-cyan-300"
          />
          {workerUrl && (
            <button onClick={() => handleClearKey('worker')}
              className="px-3 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-zinc-400 hover:text-red-400 transition-colors"
              title="Clear">
              <Trash2 size={14} />
            </button>
          )}
        </div>
        {!workerUrl && (
          <div className="flex items-start gap-2 text-xs text-zinc-500 bg-zinc-800/50 border border-zinc-800 rounded-lg p-3">
            <AlertCircle size={12} className="shrink-0 mt-0.5" />
            <span>Optional. Without it, metadata will come from oEmbed (limited) or Apify (if configured).</span>
          </div>
        )}
      </div>

      {/* Security */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-2">
        <h4 className="text-xs font-medium text-zinc-400">How your keys are stored</h4>
        <ul className="text-xs text-zinc-500 space-y-1">
          <li>• Saved in Firestore under your personal account only</li>
          <li>• Encrypted at rest by Google Cloud</li>
          <li>• Only accessible by you (Firestore security rules)</li>
          <li>• API keys sent directly from your browser to each service — never through a server</li>
          <li>• Delete them anytime with the trash buttons</li>
        </ul>
      </div>
    </div>
  )
}
