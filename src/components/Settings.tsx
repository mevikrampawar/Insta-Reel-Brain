import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Settings as SettingsIcon, Save, Check, ExternalLink, Trash2, Bot, Zap, Loader2, XCircle, Sparkles, Eye, EyeOff, AlertTriangle, Smartphone, Download, Copy, ChevronDown, RefreshCw } from 'lucide-react'
import { db, auth } from '../services/firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { GoogleAuthProvider, reauthenticateWithPopup } from 'firebase/auth'
import { clearAllUserData } from '../services/userData'
import { getErrorLog, clearErrorLog, type ErrorEntry } from '../utils/errorReporter'
import { toast } from 'sonner'

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
  const [dangerOpen, setDangerOpen] = useState(false)
  const [dangerStep, setDangerStep] = useState<'confirm' | 'reauth' | 'type-delete' | 'deleting' | 'done'>('confirm')
  const [deleteInput, setDeleteInput] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [copiedUid, setCopiedUid] = useState(false)
  const [copiedShortcutUrl, setCopiedShortcutUrl] = useState(false)
  const [copiedRelayJson, setCopiedRelayJson] = useState(false)
  const [iosShortcutOpen, setIosShortcutOpen] = useState(false)
  const [bgRelayOpen, setBgRelayOpen] = useState(false)
  const [pwaOpen, setPwaOpen] = useState(false)
  const [errorLog, setErrorLog] = useState<ErrorEntry[]>([])
  const mounted = useRef(true)

  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  useEffect(() => { setErrorLog(getErrorLog()) }, [])

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

  // --- Danger Zone: multi-step deletion flow ---
  const openDangerZone = useCallback(() => {
    setDangerOpen(true)
    setDangerStep('confirm')
    setDeleteInput('')
    setDeleteError('')
  }, [])

  const handleReauth = useCallback(async () => {
    setDangerStep('reauth')
    setDeleteError('')
    try {
      const provider = new GoogleAuthProvider()
      if (!auth.currentUser) throw new Error('Not signed in')
      await reauthenticateWithPopup(auth.currentUser, provider)
      // Re-auth successful — move to type-delete step
      setDangerStep('type-delete')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Re-authentication failed'
      if (msg.includes('popup-closed-by-user') || msg.includes('cancelled')) {
        setDeleteError('You closed the sign-in popup. Please try again.')
        setDangerStep('confirm')
      } else {
        setDeleteError(`Re-authentication failed: ${msg}`)
        setDangerStep('confirm')
      }
    }
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (deleteInput.trim() !== 'DELETE') {
      setDeleteError('Type DELETE to confirm')
      return
    }
    setDangerStep('deleting')
    setDeleteError('')
    try {
      const result = await clearAllUserData(userId)
      setDangerStep('done')
      toast.success(`All data deleted (${result.deleted} items removed)`)
      // Reset API key state since settings were cleared
      setGroq(empty)
      setApify(empty)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Deletion failed'
      setDeleteError(`Deletion failed: ${msg}`)
      setDangerStep('type-delete')
    }
  }, [userId, deleteInput])

  const closeDangerZone = useCallback(() => {
    setDangerOpen(false)
    setDangerStep('confirm')
    setDeleteInput('')
    setDeleteError('')
  }, [])

  const copyToClipboard = useCallback(async (text: string, setCopied: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }, [])

  if (loading) return <div className="p-8 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>

  const groqUnsaved = groq.local.trim() !== groq.cloud
  const apifyUnsaved = apify.local.trim() !== apify.cloud
  const hasGroq = groq.local.trim().length > 0
  const hasApify = apify.local.trim().length > 0

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6" data-tour="settings">

      {/* Page header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center">
            <SettingsIcon size={20} className="text-zinc-400" />
          </div>
          Settings
        </h1>
        <p className="text-sm text-zinc-500">Manage your API keys and preferences</p>
      </div>

      {/* API Keys section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-tour="api-keys">

        {/* Groq API Key */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                  <Zap size={16} className="text-indigo-400" />
                </div>
                <CardTitle className="text-sm">Groq API Key</CardTitle>
              </div>
              {groq.savedFlash && <Badge variant="success"><Check size={10} className="mr-1" /> Saved</Badge>}
              {!groq.savedFlash && !groq.saving && hasGroq && !groqUnsaved && <Badge variant="success"><Check size={10} className="mr-1" /> Saved</Badge>}
              {!groq.savedFlash && groqUnsaved && hasGroq && <Badge variant="warning">Unsaved</Badge>}
            </div>
            <CardDescription>Powers AI analysis (free)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <a href="https://console.groq.com" target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              Get free key at console.groq.com <ExternalLink size={10} />
            </a>
            <div className="relative">
              <Input
                type={showGroq ? 'text' : 'password'}
                value={groq.local}
                onChange={e => setGroq(s => ({ ...s, local: e.target.value, testResult: null }))}
                placeholder="gsk_..."
                className="font-mono pr-16"
              />
              <button
                onClick={() => setShowGroq(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showGroq ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => save('groq')} disabled={!groqUnsaved || groq.saving} className="gap-1.5">
                {groq.saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                {groq.saving ? 'Saving...' : 'Save'}
              </Button>
              {hasGroq && (
                <>
                  <Button variant="outline" size="sm" onClick={() => clear('groq')} className="gap-1.5 text-zinc-400 hover:text-red-400">
                    <Trash2 size={12} /> Clear
                  </Button>
                  <Button variant="outline" size="sm" onClick={testGroq} disabled={groq.testing} className="gap-1.5">
                    {groq.testing ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                    {groq.testing ? 'Testing...' : 'Test'}
                  </Button>
                </>
              )}
            </div>
            {groq.testResult === 'ok' && <p className="text-xs text-emerald-400 flex items-center gap-1"><Check size={12} /> Connected</p>}
            {groq.testResult === 'fail' && <p className="text-xs text-red-400 flex items-center gap-1"><XCircle size={12} /> Failed</p>}
          </CardContent>
        </Card>

        {/* Apify API Key */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <Bot size={16} className="text-orange-400" />
                </div>
                <CardTitle className="text-sm">Apify API Key</CardTitle>
              </div>
              {apify.savedFlash && <Badge variant="success"><Check size={10} className="mr-1" /> Saved</Badge>}
              {!apify.savedFlash && !apify.saving && hasApify && !apifyUnsaved && <Badge variant="success"><Check size={10} className="mr-1" /> Saved</Badge>}
              {!apify.savedFlash && apifyUnsaved && hasApify && <Badge variant="warning">Unsaved</Badge>}
            </div>
            <CardDescription>Scrapes reel data ($5 free credit)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <a href="https://console.apify.com" target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 transition-colors">
              Get free key at console.apify.com <ExternalLink size={10} />
            </a>
            <div className="relative">
              <Input
                type={showApify ? 'text' : 'password'}
                value={apify.local}
                onChange={e => setApify(s => ({ ...s, local: e.target.value, testResult: null }))}
                placeholder="apify_api_..."
                className="font-mono pr-16"
              />
              <button
                onClick={() => setShowApify(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showApify ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => save('apify')} disabled={!apifyUnsaved || apify.saving} className="gap-1.5">
                {apify.saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                {apify.saving ? 'Saving...' : 'Save'}
              </Button>
              {hasApify && (
                <>
                  <Button variant="outline" size="sm" onClick={() => clear('apify')} className="gap-1.5 text-zinc-400 hover:text-red-400">
                    <Trash2 size={12} /> Clear
                  </Button>
                  <Button variant="outline" size="sm" onClick={testApify} disabled={apify.testing} className="gap-1.5">
                    {apify.testing ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                    {apify.testing ? 'Testing...' : 'Test'}
                  </Button>
                </>
              )}
            </div>
            {apify.testResult === 'ok' && <p className="text-xs text-emerald-400 flex items-center gap-1"><Check size={12} /> Connected</p>}
            {apify.testResult === 'fail' && <p className="text-xs text-red-400 flex items-center gap-1"><XCircle size={12} /> Failed</p>}
          </CardContent>
        </Card>
      </div>

      {/* Trial mode card */}
      <Card className="bg-indigo-500/10 border-indigo-500/20">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-indigo-400" />
            <p className="text-xs font-medium text-indigo-300">Trial Mode Active</p>
          </div>
          <p className="text-xs text-zinc-400">
            Reel Brain includes built-in trial API keys so you can try the app without signing up for anything.
            Add your own keys for unlimited use — both are free to get.
          </p>
        </CardContent>
      </Card>

      {/* ── Setup Guides ───────────────────────────────── */}
      <Separator />
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Setup Guides</h2>
        <p className="text-xs text-zinc-500">Configure how you add reels to your library</p>
      </div>

      {/* iOS Shortcut (Deep Link) */}
      <Card className="overflow-hidden">
        <button
          onClick={() => setIosShortcutOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-zinc-300 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <Smartphone size={16} className="text-indigo-400" />
            </div>
            <div className="text-left">
              <p className="font-medium">iOS Shortcut (Recommended)</p>
              <p className="text-[10px] text-zinc-500">Share reels from Instagram directly into Reel Brain</p>
            </div>
          </div>
          <ChevronDown size={14} className={`text-zinc-500 transition-transform ${iosShortcutOpen ? 'rotate-180' : ''}`} />
        </button>
        {iosShortcutOpen && (
          <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
            <ol className="text-[11px] text-zinc-400 space-y-1.5 list-decimal list-inside">
              <li>Open the <strong className="text-zinc-300">Shortcuts</strong> app on your iPhone (pre-installed)</li>
              <li>Tap <strong className="text-zinc-300">+</strong> → <strong className="text-zinc-300">Add Action</strong> → search "Receive input" → select <strong className="text-zinc-300">Receive Input from Share Sheet</strong></li>
              <li>Tap <strong className="text-zinc-300">Add Action</strong> → search "Open URLs" → tap it</li>
              <li>Tap <strong className="text-zinc-300">URL</strong> → delete the default → paste this:</li>
            </ol>
            <div className="flex items-center gap-1.5">
              <code className="flex-1 text-[10px] text-amber-300 bg-zinc-900 rounded px-2 py-1.5 truncate font-mono">
                https://mevikrampawar.github.io/Insta-Reel-Brain/?url=[Shortcut Input]
              </code>
              <button
                onClick={() => copyToClipboard('https://mevikrampawar.github.io/Insta-Reel-Brain/?url=[Shortcut Input]', setCopiedShortcutUrl)}
                className="min-w-[32px] min-h-[32px] flex items-center justify-center px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-colors shrink-0"
                title="Copy URL template"
              >
                {copiedShortcutUrl ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} className="text-amber-300" />}
              </button>
            </div>
            <ol className="text-[11px] text-zinc-400 space-y-1.5 list-decimal list-inside" start={5}>
              <li>Tap the shortcut name → rename it <strong className="text-zinc-300">"Add to Reel Brain"</strong> → Done</li>
            </ol>
            <p className="text-[10px] text-zinc-500">Use it: Instagram → Share → tap "Add to Reel Brain". The app opens and processes the reel automatically.</p>
          </div>
        )}
      </Card>

      {/* iOS Background Relay (Cloudflare Worker) */}
      <Card className="overflow-hidden">
        <button
          onClick={() => setBgRelayOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-zinc-300 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Zap size={16} className="text-purple-400" />
            </div>
            <div className="text-left">
              <p className="font-medium">iOS Background Relay</p>
              <p className="text-[10px] text-zinc-500">Save reels without leaving Instagram (advanced, requires Cloudflare Worker)</p>
            </div>
          </div>
          <ChevronDown size={14} className={`text-zinc-500 transition-transform ${bgRelayOpen ? 'rotate-180' : ''}`} />
        </button>
        {bgRelayOpen && (
          <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
            <p className="text-[11px] text-zinc-400">
              This sends reel URLs to a Cloudflare Worker in the background — no browser opens, no scrolling interrupted.
              Requires a one-time Cloudflare Worker setup (see <a href="https://github.com/mevikrampawar/Insta-Reel-Brain/tree/main/worker" target="_blank" rel="noopener" className="text-indigo-400 hover:text-indigo-300">worker README</a>).
            </p>
            <div className="bg-zinc-800/50 rounded-lg p-3 space-y-2">
              <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Your User ID</p>
              <p className="text-[10px] text-zinc-500">Paste this into your iOS Shortcut's <code className="text-zinc-400">userId</code> field:</p>
              <div className="flex items-center gap-1.5">
                <code className="flex-1 text-[10px] text-amber-300 bg-zinc-900 rounded px-2 py-1.5 font-mono truncate">{userId}</code>
                <button
                  onClick={() => copyToClipboard(userId, setCopiedUid)}
                  className="min-w-[32px] min-h-[32px] flex items-center justify-center px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-colors shrink-0"
                  title="Copy User ID"
                >
                  {copiedUid ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} className="text-amber-300" />}
                </button>
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">Your shortcut JSON body should look like:</p>
              <div className="flex items-center gap-1.5">
                <code className="flex-1 text-[9px] text-zinc-400 bg-zinc-900 rounded px-2 py-1.5 font-mono break-all">
                  {`{"url": "[Shortcut Input]", "userId": "${userId}"}`}
                </code>
                <button
                  onClick={() => copyToClipboard(`{"url": "[Shortcut Input]", "userId": "${userId}"}`, setCopiedRelayJson)}
                  className="min-w-[32px] min-h-[32px] flex items-center justify-center px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-colors shrink-0"
                  title="Copy JSON body"
                >
                  {copiedRelayJson ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} className="text-amber-300" />}
                </button>
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">
                Also add a <code className="text-zinc-400">X-Relay-Secret</code> header = the <code className="text-zinc-400">RELAY_SECRET</code> you set in Cloudflare. Requests without it are rejected.
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* PWA Installation */}
      <Card className="overflow-hidden">
        <button
          onClick={() => setPwaOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-zinc-300 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Download size={16} className="text-emerald-400" />
            </div>
            <div className="text-left">
              <p className="font-medium">Install as App (PWA)</p>
              <p className="text-[10px] text-zinc-500">Add to home screen for a native app experience</p>
            </div>
          </div>
          <ChevronDown size={14} className={`text-zinc-500 transition-transform ${pwaOpen ? 'rotate-180' : ''}`} />
        </button>
        {pwaOpen && (
          <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
            <div className="space-y-2">
              <p className="text-[11px] text-zinc-300 font-medium">Android / Chrome</p>
              <ol className="text-[11px] text-zinc-400 space-y-1 list-decimal list-inside">
                <li>Open <a href="https://mevikrampawar.github.io/Insta-Reel-Brain/" target="_blank" rel="noopener" className="text-indigo-400 hover:text-indigo-300">Reel Brain</a> in Chrome</li>
                <li>Tap the <strong className="text-zinc-300">Install</strong> prompt (or Chrome menu → Install app)</li>
                <li>From Instagram: Share → Reel Brain appears in the share sheet</li>
              </ol>
            </div>
            <div className="space-y-2">
              <p className="text-[11px] text-zinc-300 font-medium">Clipboard Detection</p>
              <p className="text-[11px] text-zinc-400">
                When you open the app, it checks your clipboard for Instagram URLs. If found, a banner appears — tap "Add it" to ingest instantly. Works on iOS 16+ and all desktop browsers.
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Error log */}
      <Separator />

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium">Diagnostics</h4>
              <p className="text-xs text-zinc-500">Recent client errors (kept on this device only)</p>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setErrorLog(getErrorLog())}>
              <RefreshCw size={12} /> Refresh
            </Button>
          </div>
          {errorLog.length === 0 ? (
            <p className="text-xs text-zinc-600">No errors recorded. Errors are captured automatically and never leave this device.</p>
          ) : (
            <div className="space-y-2">
              {errorLog.slice(0, 10).map((entry, i) => (
                <div key={i} className="bg-zinc-800/50 rounded-lg px-3 py-2 text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-red-400 font-medium capitalize truncate">{entry.type}</span>
                    <span className="text-zinc-600 shrink-0">{new Date(entry.ts).toLocaleString()}</span>
                  </div>
                  <p className="text-zinc-300 mt-0.5 break-words">{entry.message}</p>
                  {entry.stack && <p className="text-zinc-600 mt-0.5 break-words line-clamp-2">{entry.stack}</p>}
                </div>
              ))}
              <Button variant="ghost" size="sm" className="text-xs text-zinc-500" onClick={() => { clearErrorLog(); setErrorLog([]) }}>
                Clear log
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Separator />

      <Card className="border-destructive/30">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium">Danger Zone</h4>
            <p className="text-xs text-zinc-500">Permanently delete all your reels, collections, notes, and settings</p>
          </div>
          <Button variant="destructive" size="sm" className="gap-1.5" onClick={openDangerZone}>
            <Trash2 size={12} /> Clear All Data
          </Button>
        </CardContent>
      </Card>

      {/* Danger Zone Dialog — multi-step confirmation */}
      <Dialog open={dangerOpen} onOpenChange={open => { if (!open) closeDangerZone() }}>
        <DialogContent className="sm:max-w-md">
          {/* Step 1: Initial confirmation */}
          {dangerStep === 'confirm' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle size={18} />
                  Delete All Data?
                </DialogTitle>
                <DialogDescription>
                  This will permanently delete <strong>everything</strong> in your account:
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-2">
                {[
                  { label: 'All reels', count: 'scraped data, transcripts, analysis' },
                  { label: 'All collections', count: 'custom and auto-assigned' },
                  { label: 'All notes', count: 'on every reel' },
                  { label: 'API keys', count: 'your saved Groq & Apify keys' },
                ].map(item => (
                  <div key={item.label} className="flex items-start gap-2 text-sm">
                    <Trash2 size={14} className="text-destructive mt-0.5 shrink-0" />
                    <div>
                      <span className="font-medium">{item.label}</span>
                      <span className="text-muted-foreground ml-1">— {item.count}</span>
                    </div>
                  </div>
                ))}
              </div>
              {deleteError && <p className="text-xs text-destructive">{deleteError}</p>}
              <DialogFooter>
                <Button variant="outline" onClick={closeDangerZone}>Cancel</Button>
                <Button variant="destructive" onClick={handleReauth} className="gap-1.5">
                  Continue
                </Button>
              </DialogFooter>
            </>
          )}

          {/* Step 2: Re-authenticate with Google */}
          {dangerStep === 'reauth' && (
            <>
              <DialogHeader>
                <DialogTitle>Verify Your Identity</DialogTitle>
                <DialogDescription>
                  For security, please sign in with Google again to confirm this deletion.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <Loader2 size={24} className="text-destructive animate-spin" />
                </div>
                <p className="text-sm text-muted-foreground">Waiting for Google sign-in...</p>
              </div>
              {deleteError && (
                <>
                  <p className="text-xs text-destructive text-center">{deleteError}</p>
                  <DialogFooter>
                    <Button variant="outline" onClick={closeDangerZone}>Cancel</Button>
                    <Button variant="destructive" onClick={handleReauth}>Try Again</Button>
                  </DialogFooter>
                </>
              )}
            </>
          )}

          {/* Step 3: Type DELETE to confirm */}
          {dangerStep === 'type-delete' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle size={18} />
                  Final Confirmation
                </DialogTitle>
                <DialogDescription>
                  Type <strong>DELETE</strong> below to permanently erase all your data. This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <Input
                  value={deleteInput}
                  onChange={e => { setDeleteInput(e.target.value); setDeleteError('') }}
                  placeholder='Type "DELETE" to confirm'
                  className="font-mono"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter' && deleteInput.trim() === 'DELETE') handleDeleteConfirm() }}
                />
                {deleteError && <p className="text-xs text-destructive">{deleteError}</p>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeDangerZone}>Cancel</Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteConfirm}
                  disabled={deleteInput.trim() !== 'DELETE'}
                  className="gap-1.5"
                >
                  <Trash2 size={12} /> Permanently Delete Everything
                </Button>
              </DialogFooter>
            </>
          )}

          {/* Step 4: Deleting in progress */}
          {dangerStep === 'deleting' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <Loader2 size={24} className="text-destructive animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Deleting all data...</p>
                <p className="text-xs text-muted-foreground mt-1">This may take a moment</p>
              </div>
            </div>
          )}

          {/* Step 5: Done */}
          {dangerStep === 'done' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Check size={24} className="text-emerald-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">All data deleted</p>
                <p className="text-xs text-muted-foreground mt-1">Your account is now clean. You can start fresh.</p>
              </div>
              <Button onClick={closeDangerZone}>Done</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
