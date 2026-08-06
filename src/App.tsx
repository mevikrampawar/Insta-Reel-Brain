import { useState, useCallback, useEffect, useMemo } from 'react'
import { useAuth } from './hooks/useAuth'
import { useReels } from './hooks/useReels'
import { useCollections } from './hooks/useCollections'
import { useScrapeQueue } from './hooks/useScrapeQueue'
import { useBatchProcess } from './hooks/useBatchProcess'
import { NotesProvider } from './hooks/NotesContext'
import { ApiKeyProvider, useApiKey } from './hooks/ApiKeyContext'
import { processReel } from './services/ingestion'
import { runApifyScrape } from './services/apify'
import { classifyReelHierarchy } from './services/groq'
import { db } from './services/firebase'
import { collection, onSnapshot, deleteDoc, doc } from 'firebase/firestore'
import { Login } from './components/Login'
import { Layout, type NavState } from './components/Layout'
import { Library } from './components/Library'
import { IngestionForm } from './components/IngestionForm'
import { NeuralGraph } from './components/NeuralGraph'
import { Chat } from './components/Chat'
import { Collections } from './components/Collections'
import { Settings } from './components/Settings'
import { DataSources } from './components/DataSources'
import { DashboardView } from './components/DashboardView'
import { BatchProgressDialog } from './components/BatchProgressDialog'
import { ErrorBoundary } from './components/ErrorBoundary'
import { startTour, isTourCompleted } from './lib/tour'

const VALID_TABS = ['dashboard', 'library', 'ingest', 'chat', 'graph', 'collections', 'datasources', 'settings']

function getInitialTab(): string {
  // 1. Check URL hash
  const hash = window.location.hash.slice(1)
  if (hash && VALID_TABS.includes(hash)) return hash
  // 2. Check localStorage
  try {
    const stored = localStorage.getItem('reelbrain-tab')
    if (stored && VALID_TABS.includes(stored)) return stored
  } catch { /* ignore */ }
  return 'dashboard'
}

function Dashboard({ user, logout }: { user: NonNullable<ReturnType<typeof useAuth>['user']>; logout: () => void }) {
  const { reels, loading: reelsLoading, addReel, updateReel, deleteReel, deleteReelsBulk } = useReels(user.uid)
  const { collections, addCollection, deleteCollection, renameCollection, addReelToCollection, removeReelFromCollection, batchDeleteCollections, batchMergeCollections, assignReelsByCategory } = useCollections(user.uid)
  const apiCtx = useApiKey()
  const masterKeyGate = useMemo(() => apiCtx.needsMasterApify
    ? { canUse: apiCtx.canUseMasterKey, reserve: apiCtx.reserveMasterUsage, release: apiCtx.releaseMasterUsage }
    : undefined,
    [apiCtx.needsMasterApify, apiCtx.canUseMasterKey, apiCtx.reserveMasterUsage, apiCtx.releaseMasterUsage])
  const { jobs, addJob, removeJob } = useScrapeQueue(apiCtx.apifyApiKey, apiCtx.apiKey, addReel, updateReel, assignReelsByCategory, masterKeyGate)
  const batch = useBatchProcess()
  const [nav, setNav] = useState<NavState>({ tab: getInitialTab() })
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null)
  const [firstRun] = useState(() => {
    try { return !localStorage.getItem('reelbrain-visited') } catch { return true }
  })

  // Handle deep link: ?url=<encoded_url> from iOS Shortcut or PWA share target
  // Also handles #ingest?url=<encoded_url> from service worker redirect
  // Also checks sessionStorage for deep links preserved through auth
  // Wait for API keys to load before processing to avoid empty-token auth errors
  useEffect(() => {
    if (apiCtx.loading) return

    // 1. Check URL query params
    const params = new URLSearchParams(window.location.search)
    let deepUrl = params.get('url')

    // 2. Check hash fragment
    if (!deepUrl && window.location.hash.includes('url=')) {
      const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '')
      deepUrl = hashParams.get('url')
    }

    // 3. Check sessionStorage (preserved through auth)
    if (!deepUrl) {
      try {
        deepUrl = sessionStorage.getItem('reelbrain-pending-deep-url')
        if (deepUrl) sessionStorage.removeItem('reelbrain-pending-deep-url')
      } catch { /* ignore */ }
    }

    if (deepUrl) {
      // Validate URL looks like an Instagram reel before processing
      if (!/^https?:\/\/(?:www\.)?instagram\.com\/(?:reel|p)\/[\w-]+/.test(deepUrl)) return

      // Clean the URL from address bar immediately to prevent re-processing on reload
      // Use both replaceState and clear sessionStorage to cover all browsers
      try {
        window.history.replaceState(null, '', `#ingest`)
        sessionStorage.removeItem('reelbrain-pending-deep-url')
      } catch { /* ignore */ }

      // Skip if this reel already exists in the library
      const alreadyExists = reels.some(r => r.url === deepUrl || r.url?.includes(deepUrl) || deepUrl.includes(r.url || ''))
      if (alreadyExists) return

      setNav({ tab: 'ingest' })
      try { localStorage.setItem('reelbrain-tab', 'ingest') } catch { /* ignore */ }
      // addJob has built-in dedup against processed URLs and in-progress queue
      const timer = setTimeout(() => addJob(deepUrl, 'ios-shortcut'), 100)
      return () => clearTimeout(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiCtx.loading, reels])

  // Listen for pending URLs written by Cloudflare Worker (iOS Shortcut background relay)
  useEffect(() => {
    if (apiCtx.loading) return
    const pendingRef = collection(db, 'users', user.uid, 'pendingUrls')
    const unsub = onSnapshot(pendingRef, (snap) => {
      for (const change of snap.docChanges()) {
        if (change.type === 'added') {
          const data = change.doc.data()
          const url = data.url as string
          if (!url) continue

          // Skip if reel already exists in library
          const alreadyExists = reels.some(r => r.url === url || r.url?.includes(url) || url.includes(r.url || ''))
          if (alreadyExists) {
            deleteDoc(doc(db, 'users', user.uid, 'pendingUrls', change.doc.id)).catch(() => {})
            continue
          }

          // addJob has built-in dedup against processed URLs and in-progress queue
          // Keep the pending doc when the free trial is exhausted so it retries next open
          addJob(url, (data.source as 'ios-shortcut') || 'ios-shortcut').then(result => {
            if (result !== 'limit-reached') {
              deleteDoc(doc(db, 'users', user.uid, 'pendingUrls', change.doc.id)).catch(() => {})
            }
          })
        }
      }
    }, () => { /* listener error — non-fatal */ })
    return unsub
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiCtx.loading, reels])

  // Clipboard detection — check for Instagram URLs when app loads
  useEffect(() => {
    const checkClipboard = async () => {
      try {
        const text = await navigator.clipboard.readText()
        const match = text?.match(/https?:\/\/(?:www\.)?instagram\.com\/(?:reel|p)\/[\w-]+/)
        if (match) setClipboardUrl(match[0])
      } catch {
        // Clipboard read denied — that's fine, user can paste manually
      }
    }
    // Delay to avoid interfering with initial render
    const timer = setTimeout(checkClipboard, 1500)
    return () => clearTimeout(timer)
  }, [])

  // Mark first visit as complete
  useEffect(() => {
    try { localStorage.setItem('reelbrain-visited', '1') } catch { /* ignore */ }
  }, [])

  // Auto-start app tour for first-time users
  useEffect(() => {
    if (firstRun && !isTourCompleted()) {
      const timer = setTimeout(() => startTour(), 2000)
      return () => clearTimeout(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const navigateToLibraryFiltered = useCallback((filters: { categories?: string[]; creator?: string }, highlightReelId?: string) => {
    handleNavChange({ tab: 'library', highlightReelId, libraryFilters: filters })
  }, [handleNavChange])

  const clearHighlight = useCallback(() => {
    setNav(prev => ({ ...prev, highlightReelId: undefined }))
  }, [])

  const handleRetroactiveAutoAssign = useCallback(async () => {
    const completeReels = reels.filter(r => r.ingestStatus === 'complete')

    const reelsToClassify = completeReels.filter(r => !r.primaryCategory || !r.categoryPath?.length)
    const classified = new Map<string, string>()
    for (const reel of reelsToClassify) {
      try {
        const categoryPath = await classifyReelHierarchy(
          apiCtx.apiKey,
          reel.summary || reel.transcript || reel.caption || '',
          reel.suggestedTags || [],
          reel.entities || [],
          reel.contentCategory || 'other',
        )
        await updateReel(reel.id, { primaryCategory: categoryPath[0], categoryPath })
        classified.set(reel.id, categoryPath[0])
      } catch { /* skip classification failure */ }
    }

    const reelData = completeReels.map(r => ({
      id: r.id,
      primaryCategory: classified.get(r.id) ?? r.primaryCategory,
    }))
    return assignReelsByCategory(reelData)
  }, [reels, apiCtx.apiKey, updateReel, assignReelsByCategory])

  const handleReAnalyze = useCallback(async (ids: string[]) => {
    for (const id of ids) {
      const reel = reels.find(r => r.id === id)
      if (!reel) continue
      await processReel(apiCtx.apiKey, {
        url: reel.url,
        transcript: reel.transcript || reel.caption || '',
        title: reel.title,
        creatorHandle: reel.creatorHandle,
        caption: reel.caption,
        hashtags: reel.hashtags,
        thumbnailUrl: reel.thumbnailUrl,
      }, id, updateReel)
    }
  }, [reels, apiCtx.apiKey, updateReel])

  const handleReScrape = useCallback(async (id: string) => {
    const reel = reels.find(r => r.id === id)
    if (!reel || !apiCtx.apifyApiKey) return
    await updateReel(id, { ingestStatus: 'scraping' })
    try {
      const { result } = await runApifyScrape(apiCtx.apifyApiKey, reel.url, { timeoutMs: 120_000 })
      await updateReel(id, {
        title: result.title || reel.title,
        caption: result.caption,
        hashtags: result.hashtags,
        mentions: result.mentions,
        creatorHandle: result.creatorHandle || reel.creatorHandle,
        creatorName: result.creatorName,
        creatorVerified: result.creatorVerified,
        creatorFollowers: result.creatorFollowers,
        creatorProfilePic: result.creatorProfilePic,
        likeCount: result.likeCount,
        commentCount: result.commentCount,
        playCount: result.playCount,
        viewCount: result.viewCount,
        durationSec: result.duration,
        videoUrl: result.videoUrl,
        thumbnailUrl: result.thumbnailUrl || reel.thumbnailUrl,
        takenAt: result.takenAt,
        shortcode: result.shortcode,
        location: result.location,
        isPaidPartnership: result.isPaidPartnership,
        taggedUsers: result.taggedUsers,
        coauthors: result.coauthors,
        topComments: result.topComments,
        audioTrack: result.audioTrack,
        audioArtist: result.audioArtist,
      })
      await processReel(apiCtx.apiKey, {
        url: reel.url,
        transcript: result.transcript || result.caption || '',
        title: result.title,
        creatorHandle: result.creatorHandle,
        caption: result.caption,
        hashtags: result.hashtags,
        thumbnailUrl: result.thumbnailUrl,
      }, id, updateReel)
    } catch {
      await updateReel(id, { ingestStatus: 'failed', errorMessage: 'Re-scrape failed' })
    }
  }, [reels, apiCtx.apifyApiKey, apiCtx.apiKey, updateReel])

  const batchReAnalyze = useCallback(async (ids: string[]) => {
    const reelMap = new Map(reels.map(r => [r.id, r]))
    await batch.runBatch(ids, async (id) => {
      const reel = reelMap.get(id)
      if (!reel) throw new Error('Reel not found')
      await processReel(apiCtx.apiKey, {
        url: reel.url,
        transcript: reel.transcript || reel.caption || '',
        title: reel.title,
        creatorHandle: reel.creatorHandle,
        caption: reel.caption,
        hashtags: reel.hashtags,
        thumbnailUrl: reel.thumbnailUrl,
      }, id, updateReel)
    }, { delayMs: batch.ANALYSIS_DELAY_MS })
  }, [reels, apiCtx.apiKey, updateReel, batch])

  const batchReScrape = useCallback(async (ids: string[]) => {
    const reelMap = new Map(reels.map(r => [r.id, r]))
    await batch.runBatch(ids, async (id) => {
      const reel = reelMap.get(id)
      if (!reel || !apiCtx.apifyApiKey) throw new Error('Reel not found or no Apify key')
      await updateReel(id, { ingestStatus: 'scraping' })
      const { result } = await runApifyScrape(apiCtx.apifyApiKey, reel.url)
      await updateReel(id, {
        title: result.title || reel.title, caption: result.caption, hashtags: result.hashtags,
        mentions: result.mentions, creatorHandle: result.creatorHandle || reel.creatorHandle,
        creatorName: result.creatorName, creatorVerified: result.creatorVerified,
        creatorFollowers: result.creatorFollowers, creatorProfilePic: result.creatorProfilePic,
        likeCount: result.likeCount, commentCount: result.commentCount,
        playCount: result.playCount, viewCount: result.viewCount,
        durationSec: result.duration, videoUrl: result.videoUrl,
        thumbnailUrl: result.thumbnailUrl || reel.thumbnailUrl, takenAt: result.takenAt,
        shortcode: result.shortcode, location: result.location,
        isPaidPartnership: result.isPaidPartnership, taggedUsers: result.taggedUsers,
        coauthors: result.coauthors, topComments: result.topComments,
        audioTrack: result.audioTrack, audioArtist: result.audioArtist,
      })
      await processReel(apiCtx.apiKey, {
        url: reel.url, transcript: result.transcript || result.caption || '',
        title: result.title, creatorHandle: result.creatorHandle,
        caption: result.caption, hashtags: result.hashtags,
        thumbnailUrl: result.thumbnailUrl,
      }, id, updateReel)
    }, { delayMs: batch.SCRAPE_DELAY_MS })
  }, [reels, apiCtx.apifyApiKey, apiCtx.apiKey, updateReel, batch])

  return (
    <Layout nav={nav} onNavChange={handleNavChange} onLogout={logout} userPhoto={user.photoURL || undefined} needsApiSetup={!apiCtx.hasOwnGroqKey && !apiCtx.hasOwnApifyKey && firstRun}>
      <ErrorBoundary>
      {nav.tab === 'dashboard' && <DashboardView reels={reels} collections={collections} onReelClick={navigateToReel} onFilterNavigate={navigateToLibraryFiltered} needsOnboarding={firstRun && reels.length === 0} onGoToIngest={() => handleNavChange({ tab: 'ingest' })} onGoToLibrary={() => handleNavChange({ tab: 'library' })} />}
      {reelsLoading && nav.tab === 'library' && (
        <div className="flex items-center justify-center h-full">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {!reelsLoading && nav.tab === 'library' && (
        <Library
          reels={reels}
          onDelete={deleteReel}
          onDeleteBulk={deleteReelsBulk}
          collections={collections}
          onAddToCollection={(reelId, collectionId) => addReelToCollection(collectionId, reelId)}
          highlightReelId={nav.highlightReelId}
          onClearHighlight={clearHighlight}
          onReAnalyze={handleReAnalyze}
          onReScrape={handleReScrape}
          libraryFilters={nav.libraryFilters}
          onBatchReAnalyze={batchReAnalyze}
          onBatchReScrape={batchReScrape}
        />
      )}
      {nav.tab === 'ingest' && (
        <IngestionForm
          jobs={jobs}
          addJob={addJob}
          removeJob={removeJob}
          apiKey={apiCtx.apiKey}
          apiKeyLoading={apiCtx.loading}
          apifyApiKey={apiCtx.apifyApiKey}
          onSwitchToLibrary={(reelId) => reelId ? navigateToReel(reelId) : handleNavChange({ tab: 'library' })}
          clipboardUrl={clipboardUrl}
          onDismissClipboard={() => setClipboardUrl(null)}
          masterUsageCount={apiCtx.masterUsageCount}
          masterUsageLimit={apiCtx.masterUsageLimit}
          needsMasterApify={apiCtx.needsMasterApify}
          hasOwnApifyKey={apiCtx.hasOwnApifyKey}
          canUseMasterKey={apiCtx.canUseMasterKey}
          onGoToSettings={() => handleNavChange({ tab: 'settings' })}
          existingReelUrls={reels.map(r => r.url)}
        />
      )}
      {nav.tab === 'chat' && <Chat reels={reels} apiKey={apiCtx.apiKey} onReelClick={navigateToReel} />}
      {nav.tab === 'graph' && <NeuralGraph reels={reels} onReelClick={navigateToReel} />}
      {nav.tab === 'collections' && (
        <Collections
          collections={collections}
          reels={reels}
          onAdd={addCollection}
          onDelete={deleteCollection}
          onRename={renameCollection}
          onBatchDelete={batchDeleteCollections}
          onBatchMerge={batchMergeCollections}
          onAddReel={addReelToCollection}
          onRemoveReel={removeReelFromCollection}
          onReelClick={navigateToReel}
          onRetroactiveAutoAssign={handleRetroactiveAutoAssign}
        />
      )}
      {nav.tab === 'datasources' && (
        <DataSources reels={reels} apifyApiKey={apiCtx.apifyApiKey} groqApiKey={apiCtx.apiKey} onReelClick={navigateToReel} />
      )}
      {nav.tab === 'settings' && <Settings userId={user.uid} />}
      </ErrorBoundary>
      {batch.progress.isRunning && (
        <BatchProgressDialog
          progress={batch.progress}
          title={batch.progress.jobs.some(j => j.status === 'processing') ? 'Processing...' : 'Batch Processing'}
          onClose={batch.reset}
          onCancel={batch.cancel}
          onPause={batch.pause}
          onResume={batch.resume}
          rateLimitNote="Batch operations are rate-limited (~7 reels/min for analysis, ~1 at a time for scraping) to stay within free API tier limits. Single reel operations are not affected."
        />
      )}
    </Layout>
  )
}

export default function App() {
  const { user, loading, signInWithGoogle, logout } = useAuth()

  // Preserve deep link URL through auth — save it before login screen replaces the page
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const deepUrl = params.get('url')
    if (deepUrl) {
      try { sessionStorage.setItem('reelbrain-pending-deep-url', deepUrl) } catch { /* ignore */ }
    }
  }, [])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!user) return <Login onLogin={signInWithGoogle} />

  return (
    <ApiKeyProvider userId={user.uid}>
      <NotesProvider userId={user.uid}>
        <Dashboard user={user} logout={logout} />
      </NotesProvider>
    </ApiKeyProvider>
  )
}
