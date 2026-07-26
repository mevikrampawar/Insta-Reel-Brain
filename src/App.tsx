import { useState, useCallback } from 'react'
import { useAuth } from './hooks/useAuth'
import { useReels } from './hooks/useReels'
import { useCollections } from './hooks/useCollections'
import { useScrapeQueue } from './hooks/useScrapeQueue'
import { ApiKeyProvider, useApiKey } from './hooks/ApiKeyContext'
import { Login } from './components/Login'
import { Layout, type NavState } from './components/Layout'
import { Library } from './components/Library'
import { IngestionForm } from './components/IngestionForm'
import { NeuralGraph } from './components/NeuralGraph'
import { Chat } from './components/Chat'
import { Collections } from './components/Collections'
import { Settings } from './components/Settings'
import { DataSources } from './components/DataSources'

function Dashboard({ user, logout }: { user: NonNullable<ReturnType<typeof useAuth>['user']>; logout: () => void }) {
  const { reels, loading: reelsLoading, addReel, updateReel, deleteReel } = useReels(user.uid)
  const { collections, addCollection, deleteCollection, addReelToCollection, autoAssignCollections } = useCollections(user.uid)
  const { apiKey, apifyApiKey } = useApiKey()
  const { jobs, addJob, removeJob } = useScrapeQueue(apifyApiKey, apiKey, addReel, updateReel, autoAssignCollections)
  const [nav, setNav] = useState<NavState>({ tab: 'library' })

  const navigateToReel = useCallback((reelId: string) => {
    setNav({ tab: 'library', highlightReelId: reelId })
  }, [])

  const clearHighlight = useCallback(() => {
    setNav(prev => ({ ...prev, highlightReelId: undefined }))
  }, [])

  return (
    <Layout nav={nav} onNavChange={setNav} onLogout={logout} userPhoto={user.photoURL || undefined}>
      {reelsLoading && nav.tab === 'library' && (
        <div className="flex items-center justify-center h-full">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {!reelsLoading && nav.tab === 'library' && (
        <Library
          reels={reels}
          onDelete={deleteReel}
          collections={collections}
          userId={user.uid}
          onAddToCollection={(reelId, collectionId) => addReelToCollection(collectionId, reelId)}
          highlightReelId={nav.highlightReelId}
          onClearHighlight={clearHighlight}
        />
      )}
      {nav.tab === 'ingest' && (
        <IngestionForm
          jobs={jobs}
          addJob={addJob}
          removeJob={removeJob}
          apiKey={apiKey}
          apifyApiKey={apifyApiKey}
          onSwitchToLibrary={() => setNav({ tab: 'library' })}
        />
      )}
      {nav.tab === 'chat' && <Chat reels={reels} apiKey={apiKey} />}
      {nav.tab === 'graph' && <NeuralGraph reels={reels} onReelClick={navigateToReel} />}
      {nav.tab === 'collections' && (
        <Collections
          collections={collections}
          reels={reels}
          onAdd={addCollection}
          onDelete={deleteCollection}
          onReelClick={navigateToReel}
        />
      )}
      {nav.tab === 'datasources' && (
        <DataSources reels={reels} apifyApiKey={apifyApiKey} groqApiKey={apiKey} onReelClick={navigateToReel} />
      )}
      {nav.tab === 'settings' && <Settings userId={user.uid} />}
    </Layout>
  )
}

export default function App() {
  const { user, loading, signInWithGoogle, logout } = useAuth()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!user) return <Login onLogin={signInWithGoogle} />

  return (
    <ApiKeyProvider userId={user.uid}>
      <Dashboard user={user} logout={logout} />
    </ApiKeyProvider>
  )
}
