import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { db } from '../services/firebase'
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore'
import { MASTER_GROQ_KEY, MASTER_APIFY_KEY, FREE_REEL_LIMIT } from '../config/masterKeys'

interface ApiKeyContextType {
  apiKey: string
  apifyApiKey: string
  loading: boolean
  hasOwnGroqKey: boolean
  hasOwnApifyKey: boolean
  masterUsageCount: number
  masterUsageLimit: number
  isUsingMasterGroq: boolean
  isUsingMasterApify: boolean
  canUseMasterKey: boolean
  incrementMasterUsage: () => Promise<void>
}

const ApiKeyContext = createContext<ApiKeyContextType>({
  apiKey: '', apifyApiKey: '', loading: true,
  hasOwnGroqKey: false, hasOwnApifyKey: false,
  masterUsageCount: 0, masterUsageLimit: FREE_REEL_LIMIT,
  isUsingMasterGroq: false, isUsingMasterApify: false,
  canUseMasterKey: true,
  incrementMasterUsage: async () => {},
})

export function ApiKeyProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [apiKey, setApiKey] = useState('')
  const [apifyApiKey, setApifyApiKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [hasOwnGroqKey, setHasOwnGroqKey] = useState(false)
  const [hasOwnApifyKey, setHasOwnApifyKey] = useState(false)
  const [masterUsageCount, setMasterUsageCount] = useState(0)

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    const unsub = onSnapshot(
      doc(db, 'users', userId, 'settings', 'preferences'),
      snap => {
        if (snap.exists()) {
          const d = snap.data()
          const ownGroq = d.groqApiKey || ''
          const ownApify = d.apifyApiKey || ''
          setHasOwnGroqKey(!!ownGroq)
          setHasOwnApifyKey(!!ownApify)
          setApiKey(ownGroq || MASTER_GROQ_KEY)
          setApifyApiKey(ownApify || MASTER_APIFY_KEY)
          setMasterUsageCount(d.masterKeyUsage || 0)
        } else {
          setHasOwnGroqKey(false)
          setHasOwnApifyKey(false)
          setApiKey(MASTER_GROQ_KEY)
          setApifyApiKey(MASTER_APIFY_KEY)
          setMasterUsageCount(0)
        }
        setLoading(false)
      },
      () => {
        setApiKey(MASTER_GROQ_KEY)
        setApifyApiKey(MASTER_APIFY_KEY)
        setLoading(false)
      },
    )
    return unsub
  }, [userId])

  const incrementMasterUsage = useCallback(async () => {
    try {
      const snap = await getDoc(doc(db, 'users', userId, 'settings', 'preferences'))
      const data = snap.exists() ? snap.data() : {}
      await setDoc(doc(db, 'users', userId, 'settings', 'preferences'), {
        ...data,
        masterKeyUsage: (data.masterKeyUsage || 0) + 1,
      })
      setMasterUsageCount(prev => prev + 1)
    } catch {
      // Best-effort tracking
    }
  }, [userId])

  const isUsingMasterGroq = !hasOwnGroqKey
  const isUsingMasterApify = !hasOwnApifyKey
  const canUseMasterKey = masterUsageCount < FREE_REEL_LIMIT

  return (
    <ApiKeyContext.Provider value={{
      apiKey, apifyApiKey, loading,
      hasOwnGroqKey, hasOwnApifyKey,
      masterUsageCount, masterUsageLimit: FREE_REEL_LIMIT,
      isUsingMasterGroq, isUsingMasterApify,
      canUseMasterKey, incrementMasterUsage,
    }}>
      {children}
    </ApiKeyContext.Provider>
  )
}

export function useApiKey() {
  return useContext(ApiKeyContext)
}
