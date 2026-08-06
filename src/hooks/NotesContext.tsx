import { createContext, useContext, useEffect, useRef, useCallback, useState, type ReactNode } from 'react'
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore'
import { db } from '../services/firebase'
import type { ReelNote } from '../types'

interface NotesStore {
  notesByReel: Record<string, ReelNote[]>
  loadingReels: Record<string, boolean>
  ensureLoaded: (reelId: string) => void
  addNote: (reelId: string, content: string) => Promise<void>
  updateNote: (reelId: string, noteId: string, content: string) => Promise<void>
  deleteNote: (reelId: string, noteId: string) => Promise<void>
}

const NotesContext = createContext<NotesStore | null>(null)

export function NotesProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [notesByReel, setNotesByReel] = useState<Record<string, ReelNote[]>>({})
  const [loadingReels, setLoadingReels] = useState<Record<string, boolean>>({})
  const loadedRef = useRef<Set<string>>(new Set())
  const inFlightRef = useRef<Map<string, Promise<void>>>(new Map())

  useEffect(() => {
    setNotesByReel({})
    setLoadingReels({})
    loadedRef.current.clear()
    inFlightRef.current.clear()
  }, [userId])

  const ensureLoaded = useCallback((reelId: string) => {
    if (!reelId || loadedRef.current.has(reelId) || inFlightRef.current.has(reelId)) return
    loadedRef.current.add(reelId)
    setLoadingReels(prev => ({ ...prev, [reelId]: true }))
    const promise = (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'users', userId, 'notes'), where('reelId', '==', reelId)))
        const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() } as ReelNote))
        fetched.sort((a, b) => b.createdAt - a.createdAt)
        setNotesByReel(prev => ({ ...prev, [reelId]: fetched }))
      } catch (e) {
        console.error('Failed to fetch notes:', e)
        loadedRef.current.delete(reelId)
      } finally {
        setLoadingReels(prev => ({ ...prev, [reelId]: false }))
        inFlightRef.current.delete(reelId)
      }
    })()
    inFlightRef.current.set(reelId, promise)
  }, [userId])

  const addNote = useCallback(async (reelId: string, content: string) => {
    const docData = { userId, reelId, content, createdAt: Date.now(), updatedAt: Date.now() }
    try {
      const ref = await addDoc(collection(db, 'users', userId, 'notes'), docData)
      loadedRef.current.add(reelId)
      setNotesByReel(prev => ({ ...prev, [reelId]: [{ id: ref.id, ...docData }, ...(prev[reelId] || [])] }))
    } catch (e) {
      console.error('Failed to add note:', e)
      throw e
    }
  }, [userId])

  const updateNote = useCallback(async (reelId: string, noteId: string, content: string) => {
    setNotesByReel(prev => ({
      ...prev,
      [reelId]: (prev[reelId] || []).map(n => n.id === noteId ? { ...n, content, updatedAt: Date.now() } : n),
    }))
    try {
      await updateDoc(doc(db, 'users', userId, 'notes', noteId), { content, updatedAt: Date.now() })
    } catch (e) {
      console.error('Failed to update note:', e)
      throw e
    }
  }, [userId])

  const deleteNote = useCallback(async (reelId: string, noteId: string) => {
    setNotesByReel(prev => ({
      ...prev,
      [reelId]: (prev[reelId] || []).filter(n => n.id !== noteId),
    }))
    try {
      await deleteDoc(doc(db, 'users', userId, 'notes', noteId))
    } catch (e) {
      console.error('Failed to delete note:', e)
      throw e
    }
  }, [userId])

  return (
    <NotesContext.Provider value={{ notesByReel, loadingReels, ensureLoaded, addNote, updateNote, deleteNote }}>
      {children}
    </NotesContext.Provider>
  )
}

export function useNotesStore(): NotesStore {
  const ctx = useContext(NotesContext)
  if (!ctx) throw new Error('useNotesStore must be used within a NotesProvider')
  return ctx
}
