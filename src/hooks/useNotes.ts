import { useState, useEffect, useCallback } from 'react'
import { collection, addDoc, getDocs, deleteDoc, updateDoc, doc, query, where, orderBy } from 'firebase/firestore'
import { db } from '../services/firebase'
import type { ReelNote } from '../types'

export function useNotes(userId: string | undefined, reelId?: string) {
  const [notes, setNotes] = useState<ReelNote[]>([])

  const fetchNotes = useCallback(async () => {
    if (!userId) { setNotes([]); return }
    try {
      let q
      if (reelId) {
        q = query(collection(db, 'users', userId, 'notes'), where('reelId', '==', reelId), orderBy('createdAt', 'desc'))
      } else {
        q = query(collection(db, 'users', userId, 'notes'), orderBy('createdAt', 'desc'))
      }
      const snap = await getDocs(q)
      setNotes(snap.docs.map(d => ({ id: d.id, ...d.data() } as ReelNote)))
    } catch {
      // Non-fatal: notes just won't load
    }
  }, [userId, reelId])

  useEffect(() => { fetchNotes() }, [fetchNotes])

  const addNote = useCallback(async (data: Partial<ReelNote>) => {
    if (!userId) return
    try {
      const docData: Record<string, unknown> = { userId, createdAt: Date.now(), updatedAt: Date.now() }
      if (data.reelId) docData.reelId = data.reelId
      if (data.content) docData.content = data.content
      await addDoc(collection(db, 'users', userId, 'notes'), docData)
      await fetchNotes()
    } catch (e) {
      console.error('Failed to add note:', e)
      throw e
    }
  }, [userId, fetchNotes])

  const updateNote = useCallback(async (id: string, content: string) => {
    if (!userId) return
    try {
      await updateDoc(doc(db, 'users', userId, 'notes', id), { content, updatedAt: Date.now() })
      await fetchNotes()
    } catch (e) {
      console.error('Failed to update note:', e)
      throw e
    }
  }, [userId, fetchNotes])

  const deleteNote = useCallback(async (id: string) => {
    if (!userId) return
    try {
      await deleteDoc(doc(db, 'users', userId, 'notes', id))
      await fetchNotes()
    } catch (e) {
      console.error('Failed to delete note:', e)
      throw e
    }
  }, [userId, fetchNotes])

  return { notes, addNote, updateNote, deleteNote }
}
