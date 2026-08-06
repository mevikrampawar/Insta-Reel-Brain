import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { db } from '../services/firebase'
import { doc, runTransaction, onSnapshot } from 'firebase/firestore'
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
  needsMasterApify: boolean
  reserveMasterUsage: () => Promise<boolean>
  releaseMasterUsage: () => Promise<void>
}

const ApiKeyContext = createContext<ApiKeyContextType>({
  apiKey: '', apifyApiKey: '', loading: true,
  hasOwnGroqKey: false, hasOwnApifyKey: false,
  masterUsageCount: 0, masterUsageLimit: FREE_REEL_LIMIT,
  isUsingMasterGroq: false, isUsingMasterApify: false,
  canUseMasterKey: true, needsMasterApify: false,
  reserveMasterUsage: async () => true,
  releaseMasterUsage: async () => {},
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

  const reserveMasterUsage = useCallback(async (): Promise<boolean> => {
    try {
      return await runTransaction(db, async txn => {
        const ref = doc(db, 'users', userId, 'settings', 'preferences')
        const snap = await txn.get(ref)
        if (!snap.exists()) {
          txn.set(ref, { groqApiKey: '', apifyApiKey: '', masterKeyUsage: 1, updatedAt: Date.now() })
          return true
        }
        const current = snap.data().masterKeyUsage || 0
        if (current >= FREE_REEL_LIMIT) return false
        txn.update(ref, { masterKeyUsage: current + 1 })
        return true
      })
    } catch {
      // Best-effort tracking
      return false
    }
  }, [userId])

  const releaseMasterUsage = useCallback(async () => {
    try {
      await runTransaction(db, async txn => {
        const ref = doc(db, 'users', userId, 'settings', 'preferences')
        const snap = await txn.get(ref)
        if (!snap.exists()) return
        const current = snap.data().masterKeyUsage || 0
        if (current <= 0) return
        txn.update(ref, { masterKeyUsage: current - 1 })
      })
    } catch {
      // Best-effort tracking
    }
  }, [userId])

  const isUsingMasterGroq = !hasOwnGroqKey
  const isUsingMasterApify = !hasOwnApifyKey
  const needsMasterApify = isUsingMasterApify
  const canUseMasterKey = masterUsageCount < FREE_REEL_LIMIT

  return (
    <ApiKeyContext.Provider value={{
      apiKey, apifyApiKey, loading,
      hasOwnGroqKey, hasOwnApifyKey,
      masterUsageCount, masterUsageLimit: FREE_REEL_LIMIT,
      isUsingMasterGroq, isUsingMasterApify,
      canUseMasterKey, needsMasterApify, reserveMasterUsage, releaseMasterUsage,
    }}>
      {children}
    </ApiKeyContext.Provider>
  )
}

export function useApiKey() {
  return useContext(ApiKeyContext)
}
