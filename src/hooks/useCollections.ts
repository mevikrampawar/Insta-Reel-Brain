import { useState, useEffect, useCallback } from 'react'
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy, arrayUnion } from 'firebase/firestore'
import { db } from '../services/firebase'
import type { Collection } from '../types'

const getUserCollections = (uid: string) => collection(db, 'users', uid, 'collections')

export function useCollections(userId: string | undefined) {
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!userId) { setCollections([]); setLoading(false); return }
    setLoading(true)
    try {
      const snap = await getDocs(query(getUserCollections(userId), orderBy('createdAt', 'desc')))
      setCollections(snap.docs.map(d => ({ id: d.id, ...d.data() } as Collection)))
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { fetch() }, [fetch])

  const addCollection = useCallback(async (data: Partial<Collection>) => {
    if (!userId) return
    await addDoc(getUserCollections(userId), { ...data, userId, reelIds: data.reelIds || [], createdAt: Date.now() })
    await fetch()
  }, [userId, fetch])

  const deleteCollection = useCallback(async (id: string) => {
    if (!userId) return
    await deleteDoc(doc(db, 'users', userId, 'collections', id))
    await fetch()
  }, [userId, fetch])

  const addReelToCollection = useCallback(async (collectionId: string, reelId: string) => {
    if (!userId) return
    await updateDoc(doc(db, 'users', userId, 'collections', collectionId), { reelIds: arrayUnion(reelId) })
    await fetch()
  }, [userId, fetch])

  return { collections, loading, addCollection, deleteCollection, addReelToCollection }
}
