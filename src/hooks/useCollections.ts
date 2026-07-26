import { useState, useEffect, useCallback } from 'react'
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy, arrayUnion } from 'firebase/firestore'
import { db } from '../services/firebase'
import type { Collection } from '../types'

const getUserCollections = (uid: string) => collection(db, 'users', uid, 'collections')

const AUTO_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#8b5cf6', '#f97316', '#14b8a6', '#e11d48']

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

  const autoAssignCollections = useCallback(async (reelId: string, tags: string[], concepts: { conceptName: string; conceptType: string }[]) => {
    if (!userId) return

    // Fresh read from Firestore
    const snap = await getDocs(getUserCollections(userId))
    const existing = snap.docs.map(d => {
      const data = d.data()
      return { id: d.id, ...data, isAuto: data.isAuto ?? false } as Collection
    })

    // Build collection names from top tags + concepts (limit to avoid explosion)
    const namesToCreate: string[] = []
    const seen = new Set<string>()

    for (const tag of tags.slice(0, 3)) {
      const name = tag.toLowerCase().trim()
      if (name && !seen.has(name)) { seen.add(name); namesToCreate.push(name) }
    }
    for (const c of concepts.slice(0, 3)) {
      const name = c.conceptName.toLowerCase().trim()
      if (name && !seen.has(name)) { seen.add(name); namesToCreate.push(name) }
    }

    if (namesToCreate.length === 0) return

    let colorIdx = existing.length

    for (const name of namesToCreate) {
      // Find existing auto-collection with this name (case-insensitive)
      const existingAuto = existing.find(c => c.name.toLowerCase() === name)

      if (existingAuto) {
        // Add reel to existing collection if not already there
        const reelIds = existingAuto.reelIds || []
        if (!reelIds.includes(reelId)) {
          try {
            await updateDoc(doc(db, 'users', userId, 'collections', existingAuto.id), {
              reelIds: arrayUnion(reelId)
            })
          } catch { /* skip */ }
        }
      } else {
        // Create new auto-collection
        try {
          await addDoc(getUserCollections(userId), {
            userId,
            name,
            description: 'Auto-generated from reel content',
            color: AUTO_COLORS[colorIdx % AUTO_COLORS.length],
            reelIds: [reelId],
            isAuto: true,
            createdAt: Date.now(),
          })
          colorIdx++
        } catch { /* skip */ }
      }
    }

    // Refresh collections state
    await fetch()
  }, [userId, fetch])

  // Retroactive: process all existing reels that don't have auto-collections
  const retroactiveAutoAssign = useCallback(async (reels: { id: string; suggestedTags: string[]; concepts: { conceptName: string; conceptType: string }[] }[]) => {
    if (!userId) return { processed: 0, assigned: 0 }

    // Fresh read from Firestore
    const snap = await getDocs(getUserCollections(userId))
    const existing = snap.docs.map(d => {
      const data = d.data()
      return { id: d.id, ...data, isAuto: data.isAuto ?? false } as Collection
    })

    let processed = 0
    let assigned = 0
    let colorIdx = existing.length

    for (const reel of reels) {
      processed++

      // Build collection names from top tags + concepts
      const namesToCreate: string[] = []
      const seen = new Set<string>()

      for (const tag of reel.suggestedTags.slice(0, 3)) {
        const name = tag.toLowerCase().trim()
        if (name && !seen.has(name)) { seen.add(name); namesToCreate.push(name) }
      }
      for (const c of reel.concepts.slice(0, 3)) {
        const name = c.conceptName.toLowerCase().trim()
        if (name && !seen.has(name)) { seen.add(name); namesToCreate.push(name) }
      }

      if (namesToCreate.length === 0) continue

      for (const name of namesToCreate) {
        const existingAuto = existing.find(c => c.name.toLowerCase() === name)

        if (existingAuto) {
          const reelIds = existingAuto.reelIds || []
          if (!reelIds.includes(reel.id)) {
            try {
              await updateDoc(doc(db, 'users', userId, 'collections', existingAuto.id), {
                reelIds: arrayUnion(reel.id)
              })
              assigned++
            } catch { /* skip */ }
          }
        } else {
          try {
            const newCollection = await addDoc(getUserCollections(userId), {
              userId,
              name,
              description: 'Auto-generated from reel content',
              color: AUTO_COLORS[colorIdx % AUTO_COLORS.length],
              reelIds: [reel.id],
              isAuto: true,
              createdAt: Date.now(),
            })
            // Add to local cache so subsequent reels can find it
            existing.push({
              id: newCollection.id,
              userId,
              name,
              description: 'Auto-generated from reel content',
              color: AUTO_COLORS[colorIdx % AUTO_COLORS.length],
              reelIds: [reel.id],
              isAuto: true,
              createdAt: Date.now(),
            })
            colorIdx++
            assigned++
          } catch { /* skip */ }
        }
      }
    }

    // Refresh collections state
    await fetch()
    return { processed, assigned }
  }, [userId, fetch])

  return { collections, loading, addCollection, deleteCollection, addReelToCollection, autoAssignCollections, retroactiveAutoAssign }
}
