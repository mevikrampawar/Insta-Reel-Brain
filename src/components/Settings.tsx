import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Key, Save, Check, AlertCircle, ExternalLink, Trash2 } from 'lucide-react'
import { db } from '../services/firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'

interface Props {
  userId: string
}

interface UserSettings {
  groqApiKey: string
  updatedAt: number
}

export function Settings({ userId }: Props) {
  const [apiKey, setApiKey] = useState('')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showKey, setShowKey] = useState(false)

  useEffect(() => {
    const load = async () => {
      const snap = await getDoc(doc(db, 'users', userId, 'settings', 'preferences'))
      if (snap.exists()) {
        const data = snap.data() as UserSettings
        setApiKey(data.groqApiKey || '')
      }
      setLoading(false)
    }
    load()
  }, [userId])

  const handleSave = async () => {
    await setDoc(doc(db, 'users', userId, 'settings', 'preferences'), {
      groqApiKey: apiKey.trim(),
      updatedAt: Date.now(),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleClear = async () => {
    setApiKey('')
    await setDoc(doc(db, 'users', userId, 'settings', 'preferences'), {
      groqApiKey: '',
      updatedAt: Date.now(),
    })
  }

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
          <p className="text-sm text-zinc-500">Configure your API key and preferences</p>
        </div>
      </div>

      {/* API Key Section */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Key size={16} className="text-indigo-400" />
          <h3 className="font-medium">Groq API Key</h3>
          <span className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded">Free</span>
        </div>

        <p className="text-sm text-zinc-400">
          Your personal API key for AI analysis. Stored securely in your account only.
          Never shared with anyone. Get a free key from Groq.
        </p>

        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <a href="https://console.groq.com" target="_blank" rel="noopener"
            className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors">
            Get free API key <ExternalLink size={10} />
          </a>
          <span>→ Sign in → API Keys → Create</span>
        </div>

        <div className="space-y-2">
          <label className="block text-xs text-zinc-500">Your API Key</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => { setApiKey(e.target.value); setSaved(false) }}
                placeholder="gsk_..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors font-mono"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-300"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <button
              onClick={handleClear}
              className="px-3 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-zinc-400 hover:text-red-400 transition-colors"
              title="Clear key"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={!apiKey.trim()}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
          >
            {saved ? <><Check size={14} /> Saved!</> : <><Save size={14} /> Save Key</>}
          </button>
          {apiKey && !saved && (
            <span className="text-xs text-zinc-500">Key entered but not saved yet</span>
          )}
          {saved && (
            <span className="text-xs text-emerald-400">Key saved to your account</span>
          )}
        </div>

        {!apiKey && (
          <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>Add a Groq API key to use AI features (analysis, search, chat). Without it, you can still store Reels manually but AI won't work.</span>
          </div>
        )}
      </div>

      {/* Security Info */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-2">
        <h4 className="text-xs font-medium text-zinc-400">How your key is stored</h4>
        <ul className="text-xs text-zinc-500 space-y-1">
          <li>• Saved in Firestore under your personal account only</li>
          <li>• Encrypted at rest by Google Cloud</li>
          <li>• Only accessible by you (Firestore security rules)</li>
          <li>• Never sent to any server except Groq API directly from your browser</li>
          <li>• You can delete it anytime with the trash button</li>
        </ul>
      </div>
    </div>
  )
}
