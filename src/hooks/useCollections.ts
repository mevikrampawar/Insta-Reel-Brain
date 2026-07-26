import { useState, useEffect, useCallback } from 'react'
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy, arrayUnion, arrayRemove } from 'firebase/firestore'
import { db } from '../services/firebase'
import { CATEGORY_COLORS } from '../utils/constants'
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
      setCollections(snap.docs.map(d => {
        const data = d.data()
        return { id: d.id, ...data, isAuto: data.isAuto ?? false } as Collection
      }))
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { fetch() }, [fetch])

  const addCollection = useCallback(async (data: Partial<Collection>) => {
    if (!userId) return
    try {
      await addDoc(getUserCollections(userId), {
        ...data,
        userId,
        reelIds: data.reelIds || [],
        isAuto: data.isAuto || false,
        createdAt: Date.now(),
      })
      await fetch()
    } catch (e) {
      console.error('Failed to add collection:', e)
      throw e
    }
  }, [userId, fetch])

  const deleteCollection = useCallback(async (id: string, _keepReels?: boolean) => {
    if (!userId) return
    try {
      await deleteDoc(doc(db, 'users', userId, 'collections', id))
      await fetch()
    } catch (e) {
      console.error('Failed to delete collection:', e)
      throw e
    }
  }, [userId, fetch])

  const renameCollection = useCallback(async (id: string, newName: string) => {
    if (!userId || !newName.trim()) return
    try {
      await updateDoc(doc(db, 'users', userId, 'collections', id), { name: newName.trim() })
      await fetch()
    } catch (e) {
      console.error('Failed to rename collection:', e)
      throw e
    }
  }, [userId, fetch])

  const addReelToCollection = useCallback(async (collectionId: string, reelId: string) => {
    if (!userId) return
    try {
      await updateDoc(doc(db, 'users', userId, 'collections', collectionId), { reelIds: arrayUnion(reelId) })
      await fetch()
    } catch (e) {
      console.error('Failed to add reel to collection:', e)
      throw e
    }
  }, [userId, fetch])

  const removeReelFromCollection = useCallback(async (collectionId: string, reelId: string) => {
    if (!userId) return
    try {
      await updateDoc(doc(db, 'users', userId, 'collections', collectionId), { reelIds: arrayRemove(reelId) })
      await fetch()
    } catch (e) {
      console.error('Failed to remove reel from collection:', e)
      throw e
    }
  }, [userId, fetch])

  const mergeCollections = useCallback(async (sourceId: string, targetId: string) => {
    if (!userId) return
    try {
      const target = collections.find(c => c.id === targetId)
      const source = collections.find(c => c.id === sourceId)
      if (!target || !source) return

      const mergedReelIds = [...new Set([...(target.reelIds || []), ...(source.reelIds || [])])]
      await updateDoc(doc(db, 'users', userId, 'collections', targetId), { reelIds: mergedReelIds })
      await deleteDoc(doc(db, 'users', userId, 'collections', sourceId))
      await fetch()
    } catch (e) {
      console.error('Failed to merge collections:', e)
      throw e
    }
  }, [userId, collections, fetch])

  const batchDeleteCollections = useCallback(async (ids: string[]) => {
    if (!userId || ids.length === 0) return
    try {
      await Promise.all(ids.map(id => deleteDoc(doc(db, 'users', userId, 'collections', id))))
      await fetch()
    } catch (e) {
      console.error('Failed to batch delete collections:', e)
      throw e
    }
  }, [userId, fetch])

  const batchMergeCollections = useCallback(async (sourceIds: string[], targetId: string) => {
    if (!userId || sourceIds.length === 0) return
    try {
      const target = collections.find(c => c.id === targetId)
      if (!target) return

      const deletePromises: Promise<void>[] = []
      let allReelIds = [...(target.reelIds || [])]
      for (const sourceId of sourceIds) {
        if (sourceId === targetId) continue
        const source = collections.find(c => c.id === sourceId)
        if (source) {
          allReelIds = [...allReelIds, ...(source.reelIds || [])]
          deletePromises.push(deleteDoc(doc(db, 'users', userId, 'collections', sourceId)))
        }
      }
      await Promise.all(deletePromises)
      const uniqueReelIds = [...new Set(allReelIds)]
      await updateDoc(doc(db, 'users', userId, 'collections', targetId), { reelIds: uniqueReelIds })
      await fetch()
    } catch (e) {
      console.error('Failed to batch merge collections:', e)
      throw e
    }
  }, [userId, collections, fetch])

  const batchRemoveReels = useCallback(async (collectionIds: string[], reelIds: string[]) => {
    if (!userId) return
    try {
      await Promise.all(collectionIds.map(cid =>
        updateDoc(doc(db, 'users', userId, 'collections', cid), { reelIds: arrayRemove(...reelIds) })
      ))
      await fetch()
    } catch (e) {
      console.error('Failed to batch remove reels:', e)
      throw e
    }
  }, [userId, fetch])

  const assignReelsByCategory = useCallback(async (reels: { id: string; primaryCategory?: string }[]) => {
    if (!userId) return { processed: 0, assigned: 0 }

    const snap = await getDocs(getUserCollections(userId))
    const existing = snap.docs.map(d => {
      const data = d.data()
      return { id: d.id, ...data, isAuto: data.isAuto ?? false } as Collection
    })

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
          assigned++ // already in collection
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

    await fetch()
    return { processed, assigned }
  }, [userId, fetch])

  return {
    collections,
    loading,
    addCollection,
    deleteCollection,
    renameCollection,
    addReelToCollection,
    removeReelFromCollection,
    mergeCollections,
    batchDeleteCollections,
    batchMergeCollections,
    batchRemoveReels,
    assignReelsByCategory,
  }
}
