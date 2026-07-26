// Minimal service worker for PWA + share target support

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})

// Handle share target: redirect URL param to the app
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Only handle share target GET requests with a url param
  if (event.request.method === 'GET' && url.searchParams.has('url')) {
    event.respondWith(
      new Response(null, {
        status: 303,
        headers: {
          'Location': `/#ingest?url=${encodeURIComponent(url.searchParams.get('url'))}`,
        },
      })
    )
    return
  }

  // Network-first strategy for navigation
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    )
    return
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  )
})
