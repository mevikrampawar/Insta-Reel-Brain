import { useState, useCallback, useEffect } from 'react'
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

const VALID_TABS = ['library', 'ingest', 'chat', 'graph', 'collections', 'datasources', 'settings']

function getInitialTab(): string {
  // 1. Check URL hash
  const hash = window.location.hash.slice(1)
  if (hash && VALID_TABS.includes(hash)) return hash
  // 2. Check localStorage
  try {
    const stored = localStorage.getItem('reelbrain-tab')
    if (stored && VALID_TABS.includes(stored)) return stored
  } catch { /* ignore */ }
  return 'library'
}

function Dashboard({ user, logout }: { user: NonNullable<ReturnType<typeof useAuth>['user']>; logout: () => void }) {
  const { reels, loading: reelsLoading, addReel, updateReel, deleteReel } = useReels(user.uid)
  const { collections, addCollection, deleteCollection, addReelToCollection, autoAssignCollections, retroactiveAutoAssign } = useCollections(user.uid)
  const { apiKey, apifyApiKey } = useApiKey()
  const { jobs, addJob, removeJob } = useScrapeQueue(apifyApiKey, apiKey, addReel, updateReel, autoAssignCollections)
  const [nav, setNav] = useState<NavState>({ tab: getInitialTab() })

  // Persist tab to localStorage + URL hash
  const handleNavChange = useCallback((newNav: NavState) => {
    setNav(newNav)
    try { localStorage.setItem('reelbrain-tab', newNav.tab) } catch { /* ignore */ }
    window.history.replaceState(null, '', `#${newNav.tab}`)
  }, [])

  // Handle browser back/forward
  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.slice(1)
      if (hash && VALID_TABS.includes(hash)) {
        setNav(prev => prev.tab === hash ? prev : { tab: hash })
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const navigateToReel = useCallback((reelId: string) => {
    handleNavChange({ tab: 'library', highlightReelId: reelId })
  }, [handleNavChange])

  const clearHighlight = useCallback(() => {
    setNav(prev => ({ ...prev, highlightReelId: undefined }))
  }, [])

  const handleRetroactiveAutoAssign = useCallback(async () => {
    const completeReels = reels.filter(r => r.ingestStatus === 'complete')
    const reelData = completeReels.map(r => ({
      id: r.id,
      suggestedTags: r.suggestedTags || [],
      concepts: r.concepts || [],
    }))
    return retroactiveAutoAssign(reelData)
  }, [reels, retroactiveAutoAssign])

  return (
    <Layout nav={nav} onNavChange={handleNavChange} onLogout={logout} userPhoto={user.photoURL || undefined}>
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
          onSwitchToLibrary={() => handleNavChange({ tab: 'library' })}
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
          onRetroactiveAutoAssign={handleRetroactiveAutoAssign}
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
