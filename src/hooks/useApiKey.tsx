import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { db } from '../services/firebase'
import { doc, onSnapshot } from 'firebase/firestore'

interface ApiKeyContextType {
  apiKey: string
  workerUrl: string
  apifyApiKey: string
  loading: boolean
}

const ApiKeyContext = createContext<ApiKeyContextType>({ apiKey: '', workerUrl: '', apifyApiKey: '', loading: true })

export function ApiKeyProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [apiKey, setApiKey] = useState('')
  const [workerUrl, setWorkerUrl] = useState('')
  const [apifyApiKey, setApifyApiKey] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    const unsub = onSnapshot(
      doc(db, 'users', userId, 'settings', 'preferences'),
      snap => {
        if (snap.exists()) {
          const d = snap.data()
          setApiKey(d.groqApiKey || '')
          setWorkerUrl(d.workerUrl || '')
          setApifyApiKey(d.apifyApiKey || '')
        } else {
          setApiKey('')
          setWorkerUrl('')
          setApifyApiKey('')
        }
        setLoading(false)
      },
      () => setLoading(false),
    )
    return unsub
  }, [userId])

  return (
    <ApiKeyContext.Provider value={{ apiKey, workerUrl, apifyApiKey, loading }}>
      {children}
    </ApiKeyContext.Provider>
  )
}

export function useApiKey() {
  return useContext(ApiKeyContext)
}
