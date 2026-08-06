// Service worker for PWA support and offline caching
// Versioned caches, shell precache at install, stale-while-revalidate for assets.

const BASE_PATH = '/Insta-Reel-Brain'
const CACHE_PREFIX = 'reelbrain-'
const CACHE_VERSION = 'v1'
const SHELL_CACHE = `${CACHE_PREFIX}${CACHE_VERSION}-shell`
const ASSET_CACHE = `${CACHE_PREFIX}${CACHE_VERSION}-assets`

const SHELL_URLS = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/manifest.json`,
  `${BASE_PATH}/icon-192.png`,
  `${BASE_PATH}/icon-512.png`,
  `${BASE_PATH}/icon-maskable-512.png`,
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== SHELL_CACHE && key !== ASSET_CACHE)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Navigation: network-first, fall back to cached shell when offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(SHELL_CACHE)
            .then((cache) => cache.put(`${BASE_PATH}/index.html`, copy))
            .catch(() => {})
          return response
        })
        .catch(() => caches.match(`${BASE_PATH}/index.html`))
    )
    return
  }

  // Same-origin static assets: stale-while-revalidate (hashed files are immutable)
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(ASSET_CACHE)
        .then(async (cache) => {
          const cached = await cache.match(request)
          const network = fetch(request)
            .then((response) => {
              if (response && response.ok) cache.put(request, response.clone())
              return response
            })
            .catch(() => cached)
          return cached || network
        })
    )
  }
})
