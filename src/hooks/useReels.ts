import { useState, useEffect, useCallback } from 'react'
import {
  collection, addDoc, getDocs, updateDoc, deleteDoc, doc,
  query, orderBy,
} from 'firebase/firestore'
import { db } from '../services/firebase'
import type { Reel } from '../types'

const getUserReels = (uid: string) => collection(db, 'users', uid, 'reels')

export function useReels(userId: string | undefined) {
  const [reels, setReels] = useState<Reel[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!userId) { setReels([]); setLoading(false); return }
    setLoading(true)
    try {
      const snap = await getDocs(query(getUserReels(userId), orderBy('createdAt', 'desc')))
      setReels(snap.docs.map(d => ({ id: d.id, ...d.data() } as Reel)))
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { fetch() }, [fetch])

  const addReel = useCallback(async (data: Partial<Reel>) => {
    if (!userId) return
    const ref = await addDoc(getUserReels(userId), { ...data, userId, ingestStatus: 'queued', createdAt: Date.now(), updatedAt: Date.now() })
    await fetch()
    return ref.id
  }, [userId, fetch])

  const updateReel = useCallback(async (id: string, data: Partial<Reel>) => {
    if (!userId) return
    await updateDoc(doc(db, 'users', userId, 'reels', id), { ...data, updatedAt: Date.now() })
    await fetch()
  }, [userId, fetch])

  const deleteReel = useCallback(async (id: string) => {
    if (!userId) return
    await deleteDoc(doc(db, 'users', userId, 'reels', id))
    await fetch()
  }, [userId, fetch])

  return { reels, loading, addReel, updateReel, deleteReel }
}
