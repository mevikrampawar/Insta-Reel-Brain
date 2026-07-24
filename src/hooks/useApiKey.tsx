import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { db } from '../services/firebase'
import { doc, onSnapshot } from 'firebase/firestore'

interface ApiKeyContextType {
  apiKey: string
  loading: boolean
}

const ApiKeyContext = createContext<ApiKeyContextType>({ apiKey: '', loading: true })

export function ApiKeyProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    const unsub = onSnapshot(
      doc(db, 'users', userId, 'settings', 'preferences'),
      snap => {
        setApiKey(snap.exists() ? (snap.data().groqApiKey || '') : '')
        setLoading(false)
      },
      () => setLoading(false),
    )
    return unsub
  }, [userId])

  return (
    <ApiKeyContext.Provider value={{ apiKey, loading }}>
      {children}
    </ApiKeyContext.Provider>
  )
}

export function useApiKey() {
  return useContext(ApiKeyContext)
}
