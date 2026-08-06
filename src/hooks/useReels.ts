import { useState, useEffect, useCallback, useRef } from 'react'
import {
  collection, addDoc, getDocs, updateDoc, deleteDoc, doc,
  query, orderBy, onSnapshot,
} from 'firebase/firestore'
import { db } from '../services/firebase'
import type { Reel } from '../types'

const getUserReels = (uid: string) => collection(db, 'users', uid, 'reels')

export function useReels(userId: string | undefined) {
  const [reels, setReels] = useState<Reel[]>([])
  const [loading, setLoading] = useState(true)
  const reelsRef = useRef<Reel[]>([])
  reelsRef.current = reels

  useEffect(() => {
    if (!userId) {
      setReels([])
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query(getUserReels(userId), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setReels(snap.docs.map(d => ({ id: d.id, ...d.data() } as Reel)))
        setLoading(false)
      },
      (err) => {
        console.error('Reels subscription failed:', err)
        setLoading(false)
      },
    )
    return unsub
  }, [userId])

  const refresh = useCallback(async () => {
    if (!userId) return
    try {
      const snap = await getDocs(query(getUserReels(userId), orderBy('createdAt', 'desc')))
      setReels(snap.docs.map(d => ({ id: d.id, ...d.data() } as Reel)))
    } catch (e) {
      console.error('Failed to refresh reels:', e)
    }
  }, [userId])

  const addReel = useCallback(async (data: Partial<Reel>) => {
    if (!userId) return
    const ref = await addDoc(getUserReels(userId), {
      ...data,
      userId,
      ingestStatus: 'queued',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    return ref.id
  }, [userId])

  const updateReel = useCallback(async (id: string, data: Partial<Reel>) => {
    if (!userId) return
    const prev = reelsRef.current.find(r => r.id === id)
    setReels(prevReels => prevReels.map(r => r.id === id ? { ...r, ...data, updatedAt: Date.now() } : r))
    try {
      await updateDoc(doc(db, 'users', userId, 'reels', id), { ...data, updatedAt: Date.now() })
    } catch (e) {
      if (prev) setReels(prevReels => prevReels.map(r => r.id === id ? prev : r))
      console.error('Failed to update reel:', e)
      throw e
    }
  }, [userId])

  const deleteReel = useCallback(async (id: string) => {
    if (!userId) return
    setReels(prev => prev.filter(r => r.id !== id))
    try {
      await deleteDoc(doc(db, 'users', userId, 'reels', id))
    } catch (e) {
      refresh()
      console.error('Failed to delete reel:', e)
      throw e
    }
  }, [userId, refresh])

  const deleteReelsBulk = useCallback(async (ids: string[]) => {
    if (!userId) return
    const idset = new Set(ids)
    setReels(prev => prev.filter(r => !idset.has(r.id)))
    try {
      await Promise.all(ids.map(id => deleteDoc(doc(db, 'users', userId, 'reels', id))))
    } catch (e) {
      refresh()
      console.error('Failed to bulk delete reels:', e)
      throw e
    }
  }, [userId, refresh])

  return { reels, loading, addReel, updateReel, deleteReel, deleteReelsBulk }
}
