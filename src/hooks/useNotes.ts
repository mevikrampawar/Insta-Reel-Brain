import { useState, useEffect, useCallback } from 'react'
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, orderBy } from 'firebase/firestore'
import { db } from '../services/firebase'
import type { ReelNote } from '../types'

export function useNotes(userId: string | undefined, reelId?: string) {
  const [notes, setNotes] = useState<ReelNote[]>([])

  const fetch = useCallback(async () => {
    if (!userId) { setNotes([]); return }
    let q: any = query(collection(db, 'users', userId, 'notes'), orderBy('createdAt', 'desc'))
    if (reelId) q = query(q, where('reelId', '==', reelId))
    const snap = await getDocs(q)
    setNotes(snap.docs.map(d => ({ id: d.id, ...(d.data() as Record<string, unknown>) } as unknown as ReelNote)))
  }, [userId, reelId])

  useEffect(() => { fetch() }, [fetch])

  const addNote = useCallback(async (data: Partial<ReelNote>) => {
    if (!userId) return
    const docData: Record<string, unknown> = { userId, createdAt: Date.now(), updatedAt: Date.now() }
    if (data.reelId) docData.reelId = data.reelId
    if (data.content) docData.content = data.content
    await addDoc(collection(db, 'users', userId, 'notes'), docData)
    await fetch()
  }, [userId, fetch])

  const deleteNote = useCallback(async (id: string) => {
    if (!userId) return
    await deleteDoc(doc(db, 'users', userId, 'notes', id))
    await fetch()
  }, [userId, fetch])

  return { notes, addNote, deleteNote, refresh: fetch }
}
