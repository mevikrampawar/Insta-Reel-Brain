import { useState, useEffect, useCallback } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import { auth, googleProvider } from '../services/firebase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => onAuthStateChanged(auth, u => { setUser(u); setLoading(false) }), [])

  const signInWithGoogle = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider)
    } catch {
      // Popup closed or blocked — silently ignore
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await signOut(auth)
    } catch {
      // Logout failed — silently ignore
    }
  }, [])

  return { user, loading, signInWithGoogle, logout }
}
