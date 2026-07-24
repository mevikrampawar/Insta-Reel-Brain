import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useReels } from './hooks/useReels'
import { useCollections } from './hooks/useCollections'

import { Login } from './components/Login'
import { Layout } from './components/Layout'
import { Library } from './components/Library'
import { IngestionForm } from './components/IngestionForm'
import { NeuralGraph } from './components/NeuralGraph'
import { Chat } from './components/Chat'
import { Collections } from './components/Collections'

export default function App() {
  const { user, loading: authLoading, signInWithGoogle, logout } = useAuth()
  const { reels, loading: reelsLoading, addReel, updateReel, deleteReel } = useReels(user?.uid)
  const { collections, addCollection, deleteCollection } = useCollections(user?.uid)
  const [tab, setTab] = useState('library')

  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!user) return <Login onLogin={signInWithGoogle} />

  return (
    <Layout activeTab={tab} onTabChange={setTab} onLogout={logout} userPhoto={user.photoURL || undefined}>
      {reelsLoading && tab === 'library' && (
        <div className="flex items-center justify-center h-full">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {!reelsLoading && tab === 'library' && (
        <Library reels={reels} onDelete={deleteReel} collections={collections} />
      )}
      {tab === 'ingest' && (
        <IngestionForm userId={user.uid} addReel={addReel} updateReel={updateReel} onDone={() => setTab('library')} />
      )}
      {tab === 'chat' && <Chat reels={reels} />}
      {tab === 'graph' && <NeuralGraph reels={reels} />}
      {tab === 'collections' && (
        <Collections collections={collections} reels={reels} onAdd={addCollection} onDelete={deleteCollection} />
      )}
    </Layout>
  )
}
