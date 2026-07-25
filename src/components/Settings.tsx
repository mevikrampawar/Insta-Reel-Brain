import { useState, useEffect, useRef, useCallback } from 'react'
import { Settings as SettingsIcon, Save, Check, AlertCircle, ExternalLink, Trash2, Bot, Zap, Globe, Loader2, XCircle } from 'lucide-react'
import { db } from '../services/firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'

interface Props { userId: string }

interface FieldState {
  local: string
  cloud: string
  saving: boolean
  savedFlash: boolean
  testing: boolean
  testResult: 'ok' | 'fail' | null
}

const empty: FieldState = { local: '', cloud: '', saving: false, savedFlash: false, testing: false, testResult: null }

export function Settings({ userId }: Props) {
  const [groq, setGroq] = useState<FieldState>(empty)
  const [backend, setBackend] = useState<FieldState>(empty)
  const [apify, setApify] = useState<FieldState>(empty)
  const [loading, setLoading] = useState(true)
  const [showGroq, setShowGroq] = useState(false)
  const [showApify, setShowApify] = useState(false)
  const mounted = useRef(true)

  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  useEffect(() => {
    const load = async () => {
      const snap = await getDoc(doc(db, 'users', userId, 'settings', 'preferences'))
      if (snap.exists() && mounted.current) {
        const d = snap.data()
        setGroq({ local: d.groqApiKey || '', cloud: d.groqApiKey || '', saving: false, savedFlash: false, testing: false, testResult: null })
        setBackend({ local: d.backendUrl || d.workerUrl || '', cloud: d.backendUrl || d.workerUrl || '', saving: false, savedFlash: false, testing: false, testResult: null })
        setApify({ local: d.apifyApiKey || '', cloud: d.apifyApiKey || '', saving: false, savedFlash: false, testing: false, testResult: null })
      }
      setLoading(false)
    }
    load()
  }, [userId])

  const save = useCallback(async (field: 'groq' | 'backend' | 'apify') => {
    const s = field === 'groq' ? groq : field === 'backend' ? backend : apify
    const set = field === 'groq' ? setGroq : field === 'backend' ? setBackend : setApify
    const key = field === 'groq' ? 'groqApiKey' : field === 'backend' ? 'backendUrl' : 'apifyApiKey'
    set(p => ({ ...p, saving: true }))
    const snap = await getDoc(doc(db, 'users', userId, 'settings', 'preferences'))
    const ex = snap.exists() ? snap.data() : { groqApiKey: '', backendUrl: '', apifyApiKey: '' }
    await setDoc(doc(db, 'users', userId, 'settings', 'preferences'), { ...ex, [key]: s.local.trim(), updatedAt: Date.now() })
    set({ local: s.local.trim(), cloud: s.local.trim(), saving: false, savedFlash: true, testing: false, testResult: null })
    setTimeout(() => set(p => ({ ...p, savedFlash: false })), 2000)
  }, [groq, backend, apify, userId])

  const clear = useCallback(async (field: 'groq' | 'backend' | 'apify') => {
    const set = field === 'groq' ? setGroq : field === 'backend' ? setBackend : setApify
    const key = field === 'groq' ? 'groqApiKey' : field === 'backend' ? 'backendUrl' : 'apifyApiKey'
    set(p => ({ ...p, local: '', saving: true }))
    const snap = await getDoc(doc(db, 'users', userId, 'settings', 'preferences'))
    const ex = snap.exists() ? snap.data() : { groqApiKey: '', backendUrl: '', apifyApiKey: '' }
    await setDoc(doc(db, 'users', userId, 'settings', 'preferences'), { ...ex, [key]: '', updatedAt: Date.now() })
    set({ local: '', cloud: '', saving: false, savedFlash: true, testing: false, testResult: null })
    setTimeout(() => set(p => ({ ...p, savedFlash: false })), 2000)
  }, [userId])

  const testGroq = useCallback(async () => {
    if (!groq.local.trim()) return
    setGroq(s => ({ ...s, testing: true, testResult: null }))
    try {
      const r = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${groq.local.trim()}` } })
      setGroq(s => ({ ...s, testing: false, testResult: r.ok ? 'ok' : 'fail' }))
    } catch { setGroq(s => ({ ...s, testing: false, testResult: 'fail' })) }
    setTimeout(() => setGroq(s => ({ ...s, testResult: null })), 4000)
  }, [groq.local])

  const testApify = useCallback(async () => {
    if (!apify.local.trim()) return
    setApify(s => ({ ...s, testing: true, testResult: null }))
    try {
      const r = await fetch(`https://api.apify.com/v2/users/me?token=${apify.local.trim()}`)
      setApify(s => ({ ...s, testing: false, testResult: r.ok ? 'ok' : 'fail' }))
    } catch { setApify(s => ({ ...s, testing: false, testResult: 'fail' })) }
    setTimeout(() => setApify(s => ({ ...s, testResult: null })), 4000)
  }, [apify.local])

  const testBackend = useCallback(async () => {
    if (!backend.local.trim()) return
    setBackend(s => ({ ...s, testing: true, testResult: null }))
    try {
      const url = backend.local.trim().startsWith('http') ? backend.local.trim() : `https://${backend.local.trim()}`
      const r = await fetch(`${url}/health`)
      setBackend(s => ({ ...s, testing: false, testResult: r.ok ? 'ok' : 'fail' }))
    } catch { setBackend(s => ({ ...s, testing: false, testResult: 'fail' })) }
    setTimeout(() => setBackend(s => ({ ...s, testResult: null })), 4000)
  }, [backend.local])

  if (loading) return <div className="p-8 flex items-center justify-center"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center"><SettingsIcon size={20} className="text-zinc-400" /></div>
        <div><h2 className="text-2xl font-bold">Settings</h2><p className="text-sm text-zinc-500">Configure API keys</p></div>
      </div>

      <FieldCard icon={<Bot size={16} className="text-orange-400" />} title="Apify API Key" badge="Required" badgeCls="bg-orange-500/10 text-orange-400"
        desc="Scrapes reel data: captions, hashtags, creator, transcript. $5 free credit (~3,300 reels)."
        link="https://console.apify.com" linkText="Get free key" linkHint="→ Sign up → Settings → API Token" linkCls="text-orange-400 hover:text-orange-300"
        state={apify} showKey={showApify} onToggleShow={() => setShowApify(v => !v)} placeholder="apify_api_..."
        onChange={v => setApify(s => ({ ...s, local: v, testResult: null }))} onSave={() => save('apify')} onClear={() => clear('apify')} onTest={testApify} />

      <BackendCard state={backend} onChange={v => setBackend(s => ({ ...s, local: v, testResult: null }))} onSave={() => save('backend')} onClear={() => clear('backend')} onTest={testBackend} />

      <FieldCard icon={<Zap size={16} className="text-indigo-400" />} title="Groq API Key" badge="Required" badgeCls="bg-indigo-500/10 text-indigo-400"
        desc="Powers AI analysis, embeddings, and chat. Get a free key in 30 seconds."
        link="https://console.groq.com" linkText="Get free key" linkHint="→ Sign in → API Keys → Create" linkCls="text-indigo-400 hover:text-indigo-300"
        state={groq} showKey={showGroq} onToggleShow={() => setShowGroq(v => !v)} placeholder="gsk_..."
        onChange={v => setGroq(s => ({ ...s, local: v, testResult: null }))} onSave={() => save('groq')} onClear={() => clear('groq')} onTest={testGroq} />

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-2">
        <h4 className="text-xs font-medium text-zinc-400">How it works</h4>
        <ul className="text-xs text-zinc-500 space-y-1">
          <li>• Apify key = scrapes reel data from Instagram</li>
          <li>• Backend URL = proxies Apify calls (browsers can't call Apify directly due to CORS)</li>
          <li>• Groq key = powers all AI features</li>
          <li>• All keys stored in your Firestore account only</li>
        </ul>
      </div>
    </div>
  )
}

function FieldCard({ icon, title, badge, badgeCls, desc, link, linkText, linkHint, linkCls, state, showKey, onToggleShow, placeholder, onChange, onSave, onClear, onTest }: {
  icon: React.ReactNode; title: string; badge: string; badgeCls: string; desc: string; link: string; linkText: string; linkHint: string; linkCls: string
  state: FieldState; showKey: boolean; onToggleShow: () => void; placeholder: string
  onChange: (v: string) => void; onSave: () => void; onClear: () => void; onTest: () => void
}) {
  const unsaved = state.local.trim() !== state.cloud
  const has = state.local.trim().length > 0
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        {icon}<h3 className="font-medium">{title}</h3>
        <span className={`text-xs px-2 py-0.5 rounded ${badgeCls}`}>{badge}</span>
        {state.savedFlash && <span className="ml-auto flex items-center gap-1 text-xs text-emerald-400"><Check size={12} /> Saved</span>}
        {!state.savedFlash && !state.saving && has && !unsaved && <span className="ml-auto flex items-center gap-1 text-xs text-emerald-400"><Check size={12} /> Saved</span>}
        {!state.savedFlash && unsaved && has && <span className="ml-auto flex items-center gap-1 text-xs text-amber-400"><AlertCircle size={12} /> Unsaved</span>}
      </div>
      <p className="text-sm text-zinc-400">{desc}</p>
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <a href={link} target="_blank" rel="noopener" className={`inline-flex items-center gap-1 ${linkCls}`}>{linkText} <ExternalLink size={10} /></a>
        <span>{linkHint}</span>
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input type={showKey ? 'text' : 'password'} value={state.local} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors font-mono" />
          <button onClick={onToggleShow} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-300">{showKey ? 'Hide' : 'Show'}</button>
        </div>
        {has && <button onClick={onClear} className="px-3 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-zinc-400 hover:text-red-400 transition-colors" title="Clear"><Trash2 size={14} /></button>}
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onSave} disabled={!unsaved || state.saving} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-medium transition-colors">
          {state.saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} {state.saving ? 'Saving...' : 'Save'}
        </button>
        <button onClick={onTest} disabled={!has || state.testing} className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-700 rounded-lg text-xs font-medium text-zinc-300 transition-colors">
          {state.testing ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />} {state.testing ? 'Testing...' : 'Test'}
        </button>
        {state.testResult === 'ok' && <span className="flex items-center gap-1 text-xs text-emerald-400"><Check size={12} /> Connected</span>}
        {state.testResult === 'fail' && <span className="flex items-center gap-1 text-xs text-red-400"><XCircle size={12} /> Failed</span>}
      </div>
    </div>
  )
}

function BackendCard({ state, onChange, onSave, onClear, onTest }: {
  state: FieldState; onChange: (v: string) => void; onSave: () => void; onClear: () => void; onTest: () => void
}) {
  const unsaved = state.local.trim() !== state.cloud
  const has = state.local.trim().length > 0
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Globe size={16} className="text-cyan-400" /><h3 className="font-medium">Backend URL</h3>
        <span className="text-xs px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded">Required</span>
        {state.savedFlash && <span className="ml-auto flex items-center gap-1 text-xs text-emerald-400"><Check size={12} /> Saved</span>}
        {!state.savedFlash && !state.saving && has && !unsaved && <span className="ml-auto flex items-center gap-1 text-xs text-emerald-400"><Check size={12} /> Saved</span>}
        {!state.savedFlash && unsaved && has && <span className="ml-auto flex items-center gap-1 text-xs text-amber-400"><AlertCircle size={12} /> Unsaved</span>}
      </div>
      <p className="text-sm text-zinc-400">
        Browsers can't call Apify directly (CORS). This free Node.js server proxies the requests. Deploy to Render, Railway, or Fly.io in 2 minutes.
      </p>
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 text-xs text-zinc-400 space-y-1">
        <p className="font-medium text-zinc-300">Deploy steps (pick one):</p>
        <p><strong className="text-cyan-300">Render:</strong> render.com → New Web Service → connect repo → Root: <code>server</code> → Start: <code>npm start</code></p>
        <p><strong className="text-cyan-300">Railway:</strong> railway.app → New Project → connect repo → set Root Dir to <code>server</code></p>
        <p><strong className="text-cyan-300">Fly.io:</strong> <code>cd server && fly launch && fly deploy</code></p>
        <p className="mt-2">4. Copy the URL → paste here → Save</p>
      </div>
      <div className="flex gap-2">
        <input value={state.local} onChange={e => onChange(e.target.value)} placeholder="https://your-app.onrender.com"
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors font-mono text-cyan-300" />
        {has && <button onClick={onClear} className="px-3 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-zinc-400 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>}
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onSave} disabled={!unsaved || state.saving} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-medium transition-colors">
          {state.saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} {state.saving ? 'Saving...' : 'Save'}
        </button>
        <button onClick={onTest} disabled={!has || state.testing} className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-700 rounded-lg text-xs font-medium text-zinc-300 transition-colors">
          {state.testing ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />} {state.testing ? 'Testing...' : 'Test'}
        </button>
        {state.testResult === 'ok' && <span className="flex items-center gap-1 text-xs text-emerald-400"><Check size={12} /> Reachable</span>}
        {state.testResult === 'fail' && <span className="flex items-center gap-1 text-xs text-red-400"><XCircle size={12} /> Unreachable</span>}
      </div>
    </div>
  )
}
