import { useState, useEffect, useRef, useCallback } from 'react'
import { Settings as SettingsIcon, Save, Check, AlertCircle, ExternalLink, Trash2, Bot, Zap, Globe, Loader2, XCircle } from 'lucide-react'
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

interface FieldState {
  local: string
  cloud: string
  saving: boolean
  savedFlash: boolean
  testing: boolean
  testResult: 'ok' | 'fail' | null
}

const emptyField: FieldState = { local: '', cloud: '', saving: false, savedFlash: false, testing: false, testResult: null }

export function Settings({ userId }: Props) {
  const [groq, setGroq] = useState<FieldState>(emptyField)
  const [worker, setWorker] = useState<FieldState>(emptyField)
  const [apify, setApify] = useState<FieldState>(emptyField)
  const [loading, setLoading] = useState(true)
  const [showGroq, setShowGroq] = useState(false)
  const [showApify, setShowApify] = useState(false)
  const mounted = useRef(true)

  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  useEffect(() => {
    const load = async () => {
      const snap = await getDoc(doc(db, 'users', userId, 'settings', 'preferences'))
      if (snap.exists() && mounted.current) {
        const d = snap.data() as UserSettings
        setGroq({ local: d.groqApiKey || '', cloud: d.groqApiKey || '', saving: false, savedFlash: false, testing: false, testResult: null })
        setWorker({ local: d.workerUrl || '', cloud: d.workerUrl || '', saving: false, savedFlash: false, testing: false, testResult: null })
        setApify({ local: d.apifyApiKey || '', cloud: d.apifyApiKey || '', saving: false, savedFlash: false, testing: false, testResult: null })
      }
      setLoading(false)
    }
    load()
  }, [userId])

  const saveField = useCallback(async (field: 'groq' | 'worker' | 'apify') => {
    const state = field === 'groq' ? groq : field === 'worker' ? worker : apify
    const setter = field === 'groq' ? setGroq : field === 'worker' ? setWorker : setApify
    const firestoreKey = field === 'groq' ? 'groqApiKey' : field === 'worker' ? 'workerUrl' : 'apifyApiKey'

    setter(s => ({ ...s, saving: true }))

    const snap = await getDoc(doc(db, 'users', userId, 'settings', 'preferences'))
    const existing = snap.exists() ? (snap.data() as UserSettings) : { groqApiKey: '', workerUrl: '', apifyApiKey: '' }

    await setDoc(doc(db, 'users', userId, 'settings', 'preferences'), {
      ...existing,
      [firestoreKey]: state.local.trim(),
      updatedAt: Date.now(),
    })

    const val = state.local.trim()
    setter({ local: val, cloud: val, saving: false, savedFlash: true, testing: false, testResult: null })
    setTimeout(() => setter(s => ({ ...s, savedFlash: false })), 2000)
  }, [groq, worker, apify, userId])

  const clearField = useCallback(async (field: 'groq' | 'worker' | 'apify') => {
    const setter = field === 'groq' ? setGroq : field === 'worker' ? setWorker : setApify
    const firestoreKey = field === 'groq' ? 'groqApiKey' : field === 'worker' ? 'workerUrl' : 'apifyApiKey'

    setter(s => ({ ...s, local: '', saving: true }))

    const snap = await getDoc(doc(db, 'users', userId, 'settings', 'preferences'))
    const existing = snap.exists() ? (snap.data() as UserSettings) : { groqApiKey: '', workerUrl: '', apifyApiKey: '' }

    await setDoc(doc(db, 'users', userId, 'settings', 'preferences'), {
      ...existing,
      [firestoreKey]: '',
      updatedAt: Date.now(),
    })

    setter({ local: '', cloud: '', saving: false, savedFlash: true, testing: false, testResult: null })
    setTimeout(() => setter(s => ({ ...s, savedFlash: false })), 2000)
  }, [userId])

  const testGroq = useCallback(async () => {
    if (!groq.local.trim()) return
    setGroq(s => ({ ...s, testing: true, testResult: null }))
    try {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${groq.local.trim()}` },
      })
      setGroq(s => ({ ...s, testing: false, testResult: res.ok ? 'ok' : 'fail' }))
    } catch {
      setGroq(s => ({ ...s, testing: false, testResult: 'fail' }))
    }
    setTimeout(() => setGroq(s => ({ ...s, testResult: null })), 4000)
  }, [groq.local])

  const testApify = useCallback(async () => {
    if (!apify.local.trim()) return
    setApify(s => ({ ...s, testing: true, testResult: null }))
    try {
      const res = await fetch(`https://api.apify.com/v2/users/me?token=${apify.local.trim()}`)
      setApify(s => ({ ...s, testing: false, testResult: res.ok ? 'ok' : 'fail' }))
    } catch {
      setApify(s => ({ ...s, testing: false, testResult: 'fail' }))
    }
    setTimeout(() => setApify(s => ({ ...s, testResult: null })), 4000)
  }, [apify.local])

  const testWorker = useCallback(async () => {
    if (!worker.local.trim()) return
    setWorker(s => ({ ...s, testing: true, testResult: null }))
    try {
      const url = worker.local.trim().startsWith('http') ? worker.local.trim() : `https://${worker.local.trim()}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'test', endpoint: 'users/me', payload: {} }),
      })
      setWorker(s => ({ ...s, testing: false, testResult: res.ok || res.status === 401 ? 'ok' : 'fail' }))
    } catch {
      setWorker(s => ({ ...s, testing: false, testResult: 'fail' }))
    }
    setTimeout(() => setWorker(s => ({ ...s, testResult: null })), 4000)
  }, [worker.local])

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center">
          <SettingsIcon size={20} className="text-zinc-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Settings</h2>
          <p className="text-sm text-zinc-500">Configure API keys and proxy</p>
        </div>
      </div>

      {/* Apify */}
      <KeyCard
        icon={<Bot size={16} className="text-orange-400" />}
        title="Apify API Key"
        badge={{ text: 'Required', cls: 'bg-orange-500/10 text-orange-400' }}
        description="Fetches reel metadata, captions, hashtags, and transcripts. $5 free credit = ~3,300 reels. No credit card."
        linkHref="https://console.apify.com"
        linkLabel="Get free API key"
        linkHint="→ Sign up → Settings → API Token"
        linkCls="text-orange-400 hover:text-orange-300"
        state={apify}
        showKey={showApify}
        onToggleShow={() => setShowApify(v => !v)}
        placeholder="apify_api_..."
        onChange={v => setApify(s => ({ ...s, local: v, testResult: null }))}
        onSave={() => saveField('apify')}
        onClear={() => clearField('apify')}
        onTest={testApify}
      />

      {/* Worker */}
      <WorkerCard
        state={worker}
        onChange={v => setWorker(s => ({ ...s, local: v, testResult: null }))}
        onSave={() => saveField('worker')}
        onClear={() => clearField('worker')}
        onTest={testWorker}
      />

      {/* Groq */}
      <KeyCard
        icon={<Zap size={16} className="text-indigo-400" />}
        title="Groq API Key"
        badge={{ text: 'Required', cls: 'bg-indigo-500/10 text-indigo-400' }}
        description="AI analysis, search embeddings, and chat. Stored securely in your Firestore account only."
        linkHref="https://console.groq.com"
        linkLabel="Get free API key"
        linkHint="→ Sign in → API Keys → Create"
        linkCls="text-indigo-400 hover:text-indigo-300"
        state={groq}
        showKey={showGroq}
        onToggleShow={() => setShowGroq(v => !v)}
        placeholder="gsk_..."
        onChange={v => setGroq(s => ({ ...s, local: v, testResult: null }))}
        onSave={() => saveField('groq')}
        onClear={() => clearField('groq')}
        onTest={testGroq}
      />

      {/* Security */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-2">
        <h4 className="text-xs font-medium text-zinc-400">How it works</h4>
        <ul className="text-xs text-zinc-500 space-y-1">
          <li>• Apify key + Worker URL work together — Worker proxies Apify calls (required for browser)</li>
          <li>• Groq key powers all AI features (analysis, embeddings, chat)</li>
          <li>• All keys stored in your Firestore account only</li>
          <li>• API keys sent directly from your browser — never through our servers</li>
        </ul>
      </div>
    </div>
  )
}

/* ── Key Card ────────────────────────────────────────────── */

function KeyCard({
  icon, title, badge, description, linkHref, linkLabel, linkHint, linkCls,
  state, showKey, onToggleShow, placeholder, onChange, onSave, onClear, onTest,
}: {
  icon: React.ReactNode
  title: string
  badge: { text: string; cls: string }
  description: string
  linkHref: string
  linkLabel: string
  linkHint: string
  linkCls: string
  state: FieldState
  showKey: boolean
  onToggleShow: () => void
  placeholder: string
  onChange: (v: string) => void
  onSave: () => void
  onClear: () => void
  onTest: () => void
}) {
  const unsaved = state.local.trim() !== state.cloud
  const hasValue = state.local.trim().length > 0

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="font-medium">{title}</h3>
        <span className={`text-xs px-2 py-0.5 rounded ${badge.cls}`}>{badge.text}</span>
        {!state.saving && !state.savedFlash && hasValue && !unsaved && (
          <span className="ml-auto flex items-center gap-1 text-xs text-emerald-400"><Check size={12} /> Saved</span>
        )}
        {state.savedFlash && (
          <span className="ml-auto flex items-center gap-1 text-xs text-emerald-400"><Check size={12} /> Saved</span>
        )}
        {!state.savedFlash && unsaved && hasValue && (
          <span className="ml-auto flex items-center gap-1 text-xs text-amber-400"><AlertCircle size={12} /> Unsaved</span>
        )}
      </div>

      <p className="text-sm text-zinc-400">{description}</p>

      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <a href={linkHref} target="_blank" rel="noopener" className={`inline-flex items-center gap-1 ${linkCls} transition-colors`}>
          {linkLabel} <ExternalLink size={10} />
        </a>
        <span>{linkHint}</span>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={showKey ? 'text' : 'password'}
            value={state.local}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors font-mono"
          />
          <button onClick={onToggleShow}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-300">
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>
        {hasValue && (
          <button onClick={onClear}
            className="px-3 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-zinc-400 hover:text-red-400 transition-colors"
            title="Clear">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button onClick={onSave} disabled={!unsaved || state.saving}
          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-medium transition-colors">
          {state.saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          {state.saving ? 'Saving...' : 'Save'}
        </button>
        <button onClick={onTest} disabled={!hasValue || state.testing}
          className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-700 rounded-lg text-xs font-medium text-zinc-300 transition-colors">
          {state.testing ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
          {state.testing ? 'Testing...' : 'Test Connection'}
        </button>
        {state.testResult === 'ok' && <span className="flex items-center gap-1 text-xs text-emerald-400"><Check size={12} /> Connected</span>}
        {state.testResult === 'fail' && <span className="flex items-center gap-1 text-xs text-red-400"><XCircle size={12} /> Failed</span>}
      </div>
    </div>
  )
}

/* ── Worker Card ─────────────────────────────────────────── */

function WorkerCard({ state, onChange, onSave, onClear, onTest }: {
  state: FieldState
  onChange: (v: string) => void
  onSave: () => void
  onClear: () => void
  onTest: () => void
}) {
  const unsaved = state.local.trim() !== state.cloud
  const hasValue = state.local.trim().length > 0

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Globe size={16} className="text-cyan-400" />
        <h3 className="font-medium">Apify Proxy (Cloudflare Worker)</h3>
        <span className="text-xs px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded">Required</span>
        {!state.saving && !state.savedFlash && hasValue && !unsaved && (
          <span className="ml-auto flex items-center gap-1 text-xs text-emerald-400"><Check size={12} /> Saved</span>
        )}
        {state.savedFlash && (
          <span className="ml-auto flex items-center gap-1 text-xs text-emerald-400"><Check size={12} /> Saved</span>
        )}
        {!state.savedFlash && unsaved && hasValue && (
          <span className="ml-auto flex items-center gap-1 text-xs text-amber-400"><AlertCircle size={12} /> Unsaved</span>
        )}
      </div>

      <p className="text-sm text-zinc-400">
        Browsers can't call Apify directly (CORS). This free Cloudflare Worker proxies the requests. Takes 2 min to set up.
      </p>

      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <a href="https://dash.cloudflare.com" target="_blank" rel="noopener"
          className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors">
          Cloudflare Dashboard <ExternalLink size={10} />
        </a>
        <span>→ Workers & Pages → Create Worker → Deploy → Edit Code → Paste → Deploy</span>
      </div>

      <div className="flex gap-2">
        <input
          value={state.local}
          onChange={e => onChange(e.target.value)}
          placeholder="https://ig-proxy.YOUR_SUBDOMAIN.workers.dev"
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors font-mono text-cyan-300"
        />
        {hasValue && (
          <button onClick={onClear}
            className="px-3 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-zinc-400 hover:text-red-400 transition-colors"
            title="Clear">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button onClick={onSave} disabled={!unsaved || state.saving}
          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-medium transition-colors">
          {state.saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          {state.saving ? 'Saving...' : 'Save'}
        </button>
        <button onClick={onTest} disabled={!hasValue || state.testing}
          className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-700 rounded-lg text-xs font-medium text-zinc-300 transition-colors">
          {state.testing ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
          {state.testing ? 'Testing...' : 'Test Connection'}
        </button>
        {state.testResult === 'ok' && <span className="flex items-center gap-1 text-xs text-emerald-400"><Check size={12} /> Reachable</span>}
        {state.testResult === 'fail' && <span className="flex items-center gap-1 text-xs text-red-400"><XCircle size={12} /> Unreachable</span>}
      </div>
    </div>
  )
}
