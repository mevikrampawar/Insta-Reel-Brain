import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Settings as SettingsIcon, Save, Check, ExternalLink, Trash2, Bot, Zap, Loader2, XCircle, Sparkles, Eye, EyeOff } from 'lucide-react'
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

      {/* Danger zone */}
      <Separator />

      <Card className="border-destructive/30">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium">Danger Zone</h4>
            <p className="text-xs text-zinc-500">Clear all data from your account</p>
          </div>
          <Button variant="destructive" size="sm" className="gap-1.5">
            <Trash2 size={12} /> Clear All Data
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
