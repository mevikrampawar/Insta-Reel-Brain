import { db } from '../services/firebase'
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore'

/**
 * Deletes ALL user data from Firestore: reels, collections, notes, and settings.
 * This is irreversible. Requires re-authentication before calling.
 */
export async function clearAllUserData(userId: string): Promise<{ deleted: number }> {
  const subcollections = ['reels', 'collections', 'notes', 'pendingUrls'] as const
  let totalDeleted = 0

  // Delete all documents in each subcollection
  for (const subcollection of subcollections) {
    const snap = await getDocs(collection(db, 'users', userId, subcollection))
    for (const d of snap.docs) {
      await deleteDoc(doc(db, 'users', userId, subcollection, d.id))
      totalDeleted++
    }
  }

  // Delete settings/preferences document
  const settingsSnap = await getDocs(collection(db, 'users', userId, 'settings'))
  for (const d of settingsSnap.docs) {
    await deleteDoc(doc(db, 'users', userId, 'settings', d.id))
    totalDeleted++
  }

  return { deleted: totalDeleted }
}
