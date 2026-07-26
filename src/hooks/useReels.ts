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

  const fetchReels = useCallback(async () => {
    if (!userId) { setReels([]); setLoading(false); return }
    setLoading(true)
    try {
      const snap = await getDocs(query(getUserReels(userId), orderBy('createdAt', 'desc')))
      setReels(snap.docs.map(d => ({ id: d.id, ...d.data() } as Reel)))
    } catch (e) {
      console.error('Failed to fetch reels:', e)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { fetchReels() }, [fetchReels])

  const addReel = useCallback(async (data: Partial<Reel>) => {
    if (!userId) return
    try {
      const ref = await addDoc(getUserReels(userId), { ...data, userId, ingestStatus: 'queued', createdAt: Date.now(), updatedAt: Date.now() })
      await fetchReels()
      return ref.id
    } catch (e) {
      console.error('Failed to add reel:', e)
      throw e
    }
  }, [userId, fetchReels])

  const updateReel = useCallback(async (id: string, data: Partial<Reel>) => {
    if (!userId) return
    try {
      await updateDoc(doc(db, 'users', userId, 'reels', id), { ...data, updatedAt: Date.now() })
      await fetchReels()
    } catch (e) {
      console.error('Failed to update reel:', e)
      throw e
    }
  }, [userId, fetchReels])

  const deleteReel = useCallback(async (id: string) => {
    if (!userId) return
    try {
      await deleteDoc(doc(db, 'users', userId, 'reels', id))
      await fetchReels()
    } catch (e) {
      console.error('Failed to delete reel:', e)
      throw e
    }
  }, [userId, fetchReels])

  const deleteReelsBulk = useCallback(async (ids: string[]) => {
    if (!userId) return
    try {
      for (const id of ids) {
        await deleteDoc(doc(db, 'users', userId, 'reels', id))
      }
      await fetchReels()
    } catch (e) {
      console.error('Failed to bulk delete reels:', e)
      throw e
    }
  }, [userId, fetchReels])

  return { reels, loading, addReel, updateReel, deleteReel, deleteReelsBulk }
}
