import { useState, useEffect, useCallback } from 'react'
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy, arrayUnion } from 'firebase/firestore'
import { db } from '../services/firebase'
import type { Collection } from '../types'

const getUserCollections = (uid: string) => collection(db, 'users', uid, 'collections')

// Color palette for auto-collections
const AUTO_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#8b5cf6', '#f97316', '#14b8a6', '#e11d48']

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
    await addDoc(getUserCollections(userId), {
      ...data,
      userId,
      reelIds: data.reelIds || [],
      isAuto: data.isAuto || false,
      createdAt: Date.now(),
    })
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

  // Auto-create collections from tags and concepts, then add reel to matching ones
  const autoAssignCollections = useCallback(async (reelId: string, tags: string[], concepts: { conceptName: string; conceptType: string }[]) => {
    if (!userId) return

    const snap = await getDocs(getUserCollections(userId))
    const existing = snap.docs.map(d => ({ id: d.id, ...d.data() } as Collection))

    // Build collection names from tags + concepts
    const autoNames = new Set<string>()
    for (const tag of tags.slice(0, 3)) {
      autoNames.add(tag.toLowerCase())
    }
    for (const c of concepts.slice(0, 3)) {
      autoNames.add(c.conceptName.toLowerCase())
    }

    let colorIdx = existing.length
    for (const name of autoNames) {
      // Check if auto-collection with this name already exists
      const existingAuto = existing.find(c => c.isAuto && c.name.toLowerCase() === name)
      if (existingAuto) {
        // Just add reel to existing collection
        if (!existingAuto.reelIds?.includes(reelId)) {
          await updateDoc(doc(db, 'users', userId, 'collections', existingAuto.id), { reelIds: arrayUnion(reelId) })
        }
      } else {
        // Create new auto-collection
        await addDoc(getUserCollections(userId), {
          userId,
          name,
          description: `Auto-generated from reel tags`,
          color: AUTO_COLORS[colorIdx % AUTO_COLORS.length],
          reelIds: [reelId],
          isAuto: true,
          createdAt: Date.now(),
        })
        colorIdx++
      }
    }
    await fetch()
  }, [userId, fetch])

  return { collections, loading, addCollection, deleteCollection, addReelToCollection, autoAssignCollections }
}
