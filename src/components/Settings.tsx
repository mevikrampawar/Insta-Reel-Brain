import { useState, useEffect, useRef, useCallback } from 'react'
import { Settings as SettingsIcon, Save, Check, AlertCircle, ExternalLink, Trash2, Bot, Zap, Loader2, XCircle, Sparkles, Copy, CheckCircle } from 'lucide-react'
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
  const [apify, setApify] = useState<FieldState>(empty)
  const [loading, setLoading] = useState(true)
  const [showGroq, setShowGroq] = useState(false)
  const [showApify, setShowApify] = useState(false)
  const [groqStepsOpen, setGroqStepsOpen] = useState(false)
  const [apifyStepsOpen, setApifyStepsOpen] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const mounted = useRef(true)

  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', userId, 'settings', 'preferences'))
        if (snap.exists() && mounted.current) {
          const d = snap.data()
          setGroq({ local: d.groqApiKey || '', cloud: d.groqApiKey || '', saving: false, savedFlash: false, testing: false, testResult: null })
          setApify({ local: d.apifyApiKey || '', cloud: d.apifyApiKey || '', saving: false, savedFlash: false, testing: false, testResult: null })
        }
      } catch {
        // Settings load failed — user can still type and save
      } finally {
        if (mounted.current) setLoading(false)
      }
    }
    load()
  }, [userId])

  const save = useCallback(async (field: 'groq' | 'apify') => {
    const s = field === 'groq' ? groq : apify
    const set = field === 'groq' ? setGroq : setApify
    const key = field === 'groq' ? 'groqApiKey' : 'apifyApiKey'
    set(p => ({ ...p, saving: true }))
    try {
      const snap = await getDoc(doc(db, 'users', userId, 'settings', 'preferences'))
      const ex = snap.exists() ? snap.data() : { groqApiKey: '', apifyApiKey: '' }
      await setDoc(doc(db, 'users', userId, 'settings', 'preferences'), { ...ex, [key]: s.local.trim(), updatedAt: Date.now() })
      set({ local: s.local.trim(), cloud: s.local.trim(), saving: false, savedFlash: true, testing: false, testResult: null })
      const t = setTimeout(() => { if (mounted.current) set(p => ({ ...p, savedFlash: false })) }, 2000)
      return () => clearTimeout(t)
    } catch {
      set(p => ({ ...p, saving: false }))
    }
  }, [groq, apify, userId])

  const clear = useCallback(async (field: 'groq' | 'apify') => {
    const set = field === 'groq' ? setGroq : setApify
    const key = field === 'groq' ? 'groqApiKey' : 'apifyApiKey'
    set(p => ({ ...p, local: '', saving: true }))
    try {
      const snap = await getDoc(doc(db, 'users', userId, 'settings', 'preferences'))
      const ex = snap.exists() ? snap.data() : { groqApiKey: '', apifyApiKey: '' }
      await setDoc(doc(db, 'users', userId, 'settings', 'preferences'), { ...ex, [key]: '', updatedAt: Date.now() })
      set({ local: '', cloud: '', saving: false, savedFlash: true, testing: false, testResult: null })
      const t = setTimeout(() => { if (mounted.current) set(p => ({ ...p, savedFlash: false })) }, 2000)
      return () => clearTimeout(t)
    } catch {
      set(p => ({ ...p, saving: false }))
    }
  }, [userId])

  const testGroq = useCallback(async () => {
    if (!groq.local.trim()) return
    setGroq(s => ({ ...s, testing: true, testResult: null }))
    try {
      const r = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${groq.local.trim()}` } })
      setGroq(s => ({ ...s, testing: false, testResult: r.ok ? 'ok' : 'fail' }))
    } catch { setGroq(s => ({ ...s, testing: false, testResult: 'fail' })) }
    const t = setTimeout(() => { if (mounted.current) setGroq(s => ({ ...s, testResult: null })) }, 4000)
    return () => clearTimeout(t)
  }, [groq.local])

  const testApify = useCallback(async () => {
    if (!apify.local.trim()) return
    setApify(s => ({ ...s, testing: true, testResult: null }))
    try {
      const r = await fetch('https://api.apify.com/v2/users/me', { headers: { Authorization: `Bearer ${apify.local.trim()}` } })
      setApify(s => ({ ...s, testing: false, testResult: r.ok ? 'ok' : 'fail' }))
    } catch { setApify(s => ({ ...s, testing: false, testResult: 'fail' })) }
    const t = setTimeout(() => { if (mounted.current) setApify(s => ({ ...s, testResult: null })) }, 4000)
    return () => clearTimeout(t)
  }, [apify.local])

  const copyToClipboard = useCallback(async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch { /* ignore */ }
  }, [])

  if (loading) return <div className="p-8 flex items-center justify-center"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center"><SettingsIcon size={20} className="text-zinc-400" /></div>
        <div><h2 className="text-2xl font-bold">Settings</h2><p className="text-sm text-zinc-500">Configure API keys</p></div>
      </div>

      {/* Trial mode info */}
      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={14} className="text-indigo-400" />
          <p className="text-xs font-medium text-indigo-300">Trial Mode Active</p>
        </div>
        <p className="text-xs text-zinc-400">Reel Brain includes built-in trial API keys so you can try the app without signing up for anything. You get <span className="font-medium text-white">5 free reels</span>. After that, add your own keys below — both are free to get.</p>
      </div>

      <FieldCard icon={<Bot size={16} className="text-orange-400" />} title="Apify API Key" badge="Required" badgeCls="bg-orange-500/10 text-orange-400"
        desc="Scrapes reel data: captions, hashtags, creator, transcript. $5 free credit (~3,300 reels)."
        stepsTitle="How to get your Apify API key"
        steps={[
          'Go to console.apify.com and sign up (free)',
          'Click your profile icon → Settings',
          'Click "API" in the left sidebar',
          'Click "Create token" → copy the token',
          'Paste it below and click Save',
        ]}
        stepsUrl="https://console.apify.com/account/integrations"
        stepsOpen={apifyStepsOpen} onToggleSteps={() => setApifyStepsOpen(v => !v)}
        link="https://console.apify.com" linkText="Get free key" linkHint="→ Sign up → Settings → API Token" linkCls="text-orange-400 hover:text-orange-300"
        state={apify} showKey={showApify} onToggleShow={() => setShowApify(v => !v)} placeholder="apify_api_..."
        onChange={v => setApify(s => ({ ...s, local: v, testResult: null }))} onSave={() => save('apify')} onClear={() => clear('apify')} onTest={testApify}
        onCopy={(v) => copyToClipboard(v, 'apify')} copied={copiedField === 'apify'} />

      <FieldCard icon={<Zap size={16} className="text-indigo-400" />} title="Groq API Key" badge="Required" badgeCls="bg-indigo-500/10 text-indigo-400"
        desc="Powers AI analysis, search, and chat. Get a free key in 30 seconds."
        stepsTitle="How to get your Groq API key"
        steps={[
          'Go to console.groq.com and sign in with Google',
          'Click "API Keys" in the left sidebar',
          'Click "Create API Key"',
          'Give it a name (e.g., "Reel Brain") and click Create',
          'Copy the key (starts with gsk_) and paste below',
        ]}
        stepsUrl="https://console.groq.com/keys"
        stepsOpen={groqStepsOpen} onToggleSteps={() => setGroqStepsOpen(v => !v)}
        link="https://console.groq.com" linkText="Get free key" linkHint="→ Sign in → API Keys → Create" linkCls="text-indigo-400 hover:text-indigo-300"
        state={groq} showKey={showGroq} onToggleShow={() => setShowGroq(v => !v)} placeholder="gsk_..."
        onChange={v => setGroq(s => ({ ...s, local: v, testResult: null }))} onSave={() => save('groq')} onClear={() => clear('groq')} onTest={testGroq}
        onCopy={(v) => copyToClipboard(v, 'groq')} copied={copiedField === 'groq'} />

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-2">
        <h4 className="text-xs font-medium text-zinc-400">How it works</h4>
        <ul className="text-xs text-zinc-500 space-y-1">
          <li>• Apify key = scrapes reel data from Instagram (called directly from browser)</li>
          <li>• Groq key = powers AI analysis, semantic search, and chat</li>
          <li>• All keys stored in your Firestore account only</li>
          <li>• No server needed — everything runs in your browser</li>
        </ul>
      </div>
    </div>
  )
}

function FieldCard({ icon, title, badge, badgeCls, desc, stepsTitle, steps, stepsUrl, stepsOpen, onToggleSteps, link, linkText, linkHint, linkCls, state, showKey, onToggleShow, placeholder, onChange, onSave, onClear, onTest, onCopy, copied }: {
  icon: React.ReactNode; title: string; badge: string; badgeCls: string; desc: string
  stepsTitle: string; steps: string[]; stepsUrl: string; stepsOpen: boolean; onToggleSteps: () => void
  link: string; linkText: string; linkHint: string; linkCls: string
  state: FieldState; showKey: boolean; onToggleShow: () => void; placeholder: string
  onChange: (v: string) => void; onSave: () => void; onClear: () => void; onTest: () => void
  onCopy: (v: string) => void; copied: boolean
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

      {/* Step-by-step guide */}
      <div className="border border-zinc-800 rounded-lg overflow-hidden">
        <button onClick={onToggleSteps} className="w-full flex items-center justify-between px-4 py-3 text-xs text-zinc-300 hover:bg-zinc-800/50 transition-colors">
          <span className="font-medium">{stepsTitle}</span>
          <span className="text-zinc-500">{stepsOpen ? '▾' : '▸'}</span>
        </button>
        {stepsOpen && (
          <div className="px-4 pb-4 space-y-2">
            <ol className="space-y-1.5">
              {steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-zinc-400">
                  <span className="w-4 h-4 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-500 shrink-0 mt-0.5">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <a href={stepsUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              Open {linkText} <ExternalLink size={10} />
            </a>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-zinc-500 flex-wrap">
        <a href={link} target="_blank" rel="noopener" className={`inline-flex items-center gap-1 ${linkCls}`}>{linkText} <ExternalLink size={10} /></a>
        <span>{linkHint}</span>
      </div>
      <div className="flex gap-2 flex-col sm:flex-row">
        <div className="relative flex-1">
          <input type={showKey ? 'text' : 'password'} value={state.local} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 min-h-[48px] text-sm focus:outline-none focus:border-indigo-500 transition-colors font-mono" />
          <button onClick={onToggleShow} className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] flex items-center justify-center text-xs text-zinc-500 hover:text-zinc-300 rounded-lg hover:bg-zinc-700/50 transition-colors">{showKey ? 'Hide' : 'Show'}</button>
        </div>
        {has && (
          <>
            <button onClick={() => onCopy(state.local)} className="min-w-[48px] min-h-[48px] flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-colors" title="Copy">
              {copied ? <CheckCircle size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
            <button onClick={onClear} className="min-w-[48px] min-h-[48px] flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-zinc-400 hover:text-red-400 transition-colors" title="Clear">
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={onSave} disabled={!unsaved || state.saving} className="flex items-center gap-1.5 px-3 min-h-[44px] bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-medium transition-colors">
          {state.saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} {state.saving ? 'Saving...' : 'Save'}
        </button>
        <button onClick={onTest} disabled={!has || state.testing} className="flex items-center gap-1.5 px-3 min-h-[44px] bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-700 rounded-lg text-xs font-medium text-zinc-300 transition-colors">
          {state.testing ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />} {state.testing ? 'Testing...' : 'Test'}
        </button>
        {state.testResult === 'ok' && <span className="flex items-center gap-1 text-xs text-emerald-400"><Check size={12} /> Connected</span>}
        {state.testResult === 'fail' && <span className="flex items-center gap-1 text-xs text-red-400"><XCircle size={12} /> Failed</span>}
      </div>
    </div>
  )
}
