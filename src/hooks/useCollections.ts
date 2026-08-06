import { useState, useEffect, useCallback, useRef } from 'react'
import {
  collection, addDoc, getDocs, deleteDoc, doc, updateDoc,
  query, orderBy, arrayUnion, arrayRemove, onSnapshot,
} from 'firebase/firestore'
import { db } from '../services/firebase'
import { CATEGORY_COLORS } from '../utils/constants'
import type { Collection } from '../types'

const getUserCollections = (uid: string) => collection(db, 'users', uid, 'collections')

function toCollection(d: { id: string; data: () => Record<string, unknown> }): Collection {
  const data = d.data()
  return { id: d.id, ...data, isAuto: data.isAuto ?? false } as Collection
}

export function useCollections(userId: string | undefined) {
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const collectionsRef = useRef<Collection[]>([])
  collectionsRef.current = collections

  useEffect(() => {
    if (!userId) {
      setCollections([])
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query(getUserCollections(userId), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setCollections(snap.docs.map(d => toCollection(d)))
        setLoading(false)
      },
      (err) => {
        console.error('Collections subscription failed:', err)
        setLoading(false)
      },
    )
    return unsub
  }, [userId])

  const refresh = useCallback(async () => {
    if (!userId) return
    try {
      const snap = await getDocs(query(getUserCollections(userId), orderBy('createdAt', 'desc')))
      setCollections(snap.docs.map(d => toCollection(d)))
    } catch (e) {
      console.error('Failed to refresh collections:', e)
    }
  }, [userId])

  const addCollection = useCallback(async (data: Partial<Collection>) => {
    if (!userId) return
    await addDoc(getUserCollections(userId), {
      ...data,
      userId,
      reelIds: data.reelIds || [],
      isAuto: data.isAuto || false,
      createdAt: Date.now(),
    })
  }, [userId])

  const deleteCollection = useCallback(async (id: string) => {
    if (!userId) return
    setCollections(prev => prev.filter(c => c.id !== id))
    try {
      await deleteDoc(doc(db, 'users', userId, 'collections', id))
    } catch (e) {
      refresh()
      console.error('Failed to delete collection:', e)
      throw e
    }
  }, [userId, refresh])

  const renameCollection = useCallback(async (id: string, newName: string) => {
    if (!userId || !newName.trim()) return
    const name = newName.trim()
    setCollections(prev => prev.map(c => c.id === id ? { ...c, name } : c))
    try {
      await updateDoc(doc(db, 'users', userId, 'collections', id), { name })
    } catch (e) {
      refresh()
      console.error('Failed to rename collection:', e)
      throw e
    }
  }, [userId, refresh])

  const addReelToCollection = useCallback(async (collectionId: string, reelId: string) => {
    if (!userId) return
    setCollections(prev => prev.map(c =>
      c.id === collectionId && !c.reelIds?.includes(reelId)
        ? { ...c, reelIds: [...(c.reelIds || []), reelId] }
        : c,
    ))
    try {
      await updateDoc(doc(db, 'users', userId, 'collections', collectionId), { reelIds: arrayUnion(reelId) })
    } catch (e) {
      refresh()
      console.error('Failed to add reel to collection:', e)
      throw e
    }
  }, [userId, refresh])

  const removeReelFromCollection = useCallback(async (collectionId: string, reelId: string) => {
    if (!userId) return
    setCollections(prev => prev.map(c =>
      c.id === collectionId
        ? { ...c, reelIds: (c.reelIds || []).filter(id => id !== reelId) }
        : c,
    ))
    try {
      await updateDoc(doc(db, 'users', userId, 'collections', collectionId), { reelIds: arrayRemove(reelId) })
    } catch (e) {
      refresh()
      console.error('Failed to remove reel from collection:', e)
      throw e
    }
  }, [userId, refresh])

  const batchDeleteCollections = useCallback(async (ids: string[]) => {
    if (!userId || ids.length === 0) return
    const idset = new Set(ids)
    setCollections(prev => prev.filter(c => !idset.has(c.id)))
    try {
      await Promise.all(ids.map(id => deleteDoc(doc(db, 'users', userId, 'collections', id))))
    } catch (e) {
      refresh()
      console.error('Failed to batch delete collections:', e)
      throw e
    }
  }, [userId, refresh])

  const batchMergeCollections = useCallback(async (sourceIds: string[], targetId: string) => {
    if (!userId || sourceIds.length === 0) return
    const target = collectionsRef.current.find(c => c.id === targetId)
    if (!target) return

    let allReelIds = [...(target.reelIds || [])]
    for (const sourceId of sourceIds) {
      if (sourceId === targetId) continue
      const source = collectionsRef.current.find(c => c.id === sourceId)
      if (source) allReelIds = [...allReelIds, ...(source.reelIds || [])]
    }
    const uniqueReelIds = [...new Set(allReelIds)]
    const merged = { ...target, reelIds: uniqueReelIds }
    setCollections(prev => prev.map(c =>
      c.id === targetId ? merged : (sourceIds.includes(c.id) ? null : c),
    ).filter((c): c is Collection => c !== null))

    try {
      await updateDoc(doc(db, 'users', userId, 'collections', targetId), { reelIds: uniqueReelIds })
      await Promise.all(sourceIds
        .filter(id => id !== targetId)
        .map(id => deleteDoc(doc(db, 'users', userId, 'collections', id))))
    } catch (e) {
      refresh()
      console.error('Failed to batch merge collections:', e)
      throw e
    }
  }, [userId, refresh])

  const assignReelsByCategory = useCallback(async (reels: { id: string; primaryCategory?: string }[]) => {
    if (!userId) return { processed: 0, assigned: 0 }

    const snap = await getDocs(getUserCollections(userId))
    const existing = snap.docs.map(d => toCollection(d))

    let processed = 0
    let assigned = 0
    const existingByName = new Map(existing.map(c => [c.name.toLowerCase(), c]))

    for (const reel of reels) {
      processed++
      const cat = reel.primaryCategory
      if (!cat) continue

      const existingCat = existingByName.get(cat.toLowerCase())

      if (existingCat) {
        const reelIds = existingCat.reelIds || []
        if (!reelIds.includes(reel.id)) {
          try {
            await updateDoc(doc(db, 'users', userId, 'collections', existingCat.id), {
              reelIds: arrayUnion(reel.id),
            })
            assigned++
          } catch { /* skip */ }
        } else {
          assigned++
        }
      } else {
        try {
          const newDoc = await addDoc(getUserCollections(userId), {
            userId,
            name: cat,
            description: `Auto-classified: ${cat}`,
            color: CATEGORY_COLORS[cat] || '#6366f1',
            reelIds: [reel.id],
            isAuto: true,
            createdAt: Date.now(),
          })
          existingByName.set(cat.toLowerCase(), {
            id: newDoc.id,
            userId,
            name: cat,
            description: `Auto-classified: ${cat}`,
            color: CATEGORY_COLORS[cat] || '#6366f1',
            reelIds: [reel.id],
            isAuto: true,
            createdAt: Date.now(),
          })
          assigned++
        } catch { /* skip */ }
      }
    }

    return { processed, assigned }
  }, [userId])

  return {
    collections,
    loading,
    addCollection,
    deleteCollection,
    renameCollection,
    addReelToCollection,
    removeReelFromCollection,
    batchDeleteCollections,
    batchMergeCollections,
    assignReelsByCategory,
  }
}
