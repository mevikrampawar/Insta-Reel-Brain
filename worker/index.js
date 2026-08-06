// Cloudflare Worker: background relay + thin server layer for Reel Brain.
//
// Routes:
//   POST / or /api/relay          — save a reel URL to pendingUrls
//                                    (auth: X-Relay-Secret header OR Bearer Firebase ID token)
//   GET  /api/me                  — verify a Firebase ID token, return user info
//   POST /api/usage/reserve       — atomically reserve one free-tier credit
//   POST /api/usage/release       — atomically release one free-tier credit
//
// SETUP:
// 1. Create a Firebase service account (Project Settings > Service Accounts > Generate New Private Key)
// 2. Secrets (Settings > Variables > Secrets):
//    FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
//      FIREBASE_PRIVATE_KEY can be stored as raw PEM (with newlines) OR base64-encoded PEM
//    RELAY_SECRET — shared secret for the iOS Shortcut (`openssl rand -hex 32`).
// 3. Bind a KV namespace (RATE_LIMIT_KV) for per-user/per-IP rate limiting.
// 4. Optional var FREE_REEL_LIMIT (default 5) — free-tier credit cap.
// 5. Update the iOS Shortcut to POST to: https://reel-brain-relay.YOUR_SUBDOMAIN.workers.dev
//    with header `X-Relay-Secret: <RELAY_SECRET>` and JSON body { url, userId }

import { verifyIdToken } from './auth'
import { writePendingUrl, reserveMasterCredit, releaseMasterCredit } from './firestore'
import { rateLimit } from './ratelimit'

const WINDOW_MS = 60 * 1000
const RELAY_IP_LIMIT = 30
const API_USER_LIMIT = 120
const DEFAULT_FREE_REEL_LIMIT = 5

export default {
  async fetch(request, env) {
    const cors = corsHeaders()

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    const url = new URL(request.url)

    if (url.pathname === '/api/me') {
      return handleMe(request, env, cors)
    }
    if (url.pathname === '/api/usage/reserve') {
      return handleReserve(request, env, cors)
    }
    if (url.pathname === '/api/usage/release') {
      return handleRelease(request, env, cors)
    }
    if (url.pathname === '/api/relay' || url.pathname === '/') {
      return handleRelay(request, env, cors)
    }

    return json({ error: 'Not found' }, 404, cors)
  },
}

// ---- Handlers ----

async function handleMe(request, env, cors) {
  if (request.method !== 'GET') return methodNotAllowed(cors)
  const principal = await authenticate(request, env)
  if (!principal) return unauthorized(cors)

  const rl = await rateLimit(env, `uid:${principal.uid}`, API_USER_LIMIT, WINDOW_MS)
  if (rl.limited) return rateLimited(cors, rl)

  return json({ ok: true, uid: principal.uid, email: principal.email, name: principal.name }, 200, cors)
}

async function handleReserve(request, env, cors) {
  if (request.method !== 'POST') return methodNotAllowed(cors)
  const principal = await authenticate(request, env)
  if (!principal) return unauthorized(cors)

  const rl = await rateLimit(env, `uid:${principal.uid}`, API_USER_LIMIT, WINDOW_MS)
  if (rl.limited) return rateLimited(cors, rl)

  const limit = Number(env.FREE_REEL_LIMIT || DEFAULT_FREE_REEL_LIMIT) || DEFAULT_FREE_REEL_LIMIT
  try {
    const result = await reserveMasterCredit(env, principal.uid, limit)
    return json({
      ok: result.ok,
      count: result.count,
      limit: result.limit,
      limitReached: !!result.limitReached,
    }, 200, cors)
  } catch (e) {
    console.error('Reserve credit failed:', e)
    return json({ error: 'Failed to reserve credit' }, 500, cors)
  }
}

async function handleRelease(request, env, cors) {
  if (request.method !== 'POST') return methodNotAllowed(cors)
  const principal = await authenticate(request, env)
  if (!principal) return unauthorized(cors)

  const rl = await rateLimit(env, `uid:${principal.uid}`, API_USER_LIMIT, WINDOW_MS)
  if (rl.limited) return rateLimited(cors, rl)

  try {
    const result = await releaseMasterCredit(env, principal.uid)
    return json({ ok: result.ok, count: result.count }, 200, cors)
  } catch (e) {
    console.error('Release credit failed:', e)
    return json({ error: 'Failed to release credit' }, 500, cors)
  }
}

async function handleRelay(request, env, cors) {
  if (request.method !== 'POST') return methodNotAllowed(cors)

  // Authenticate: shared secret (Shortcut) OR Firebase ID token (app).
  const principal = await authenticate(request, env)
  const secretOk = isAuthorized(request, env)
  if (!principal && !secretOk) {
    console.warn('Relay rejected: missing or invalid credentials')
    return unauthorized(cors)
  }

  if (principal) {
    const rl = await rateLimit(env, `uid:${principal.uid}`, API_USER_LIMIT, WINDOW_MS)
    if (rl.limited) return rateLimited(cors, rl)
  } else {
    const cf = request.cf || {}
    const ip = cf.connectingIp || 'unknown'
    const rl = await rateLimit(env, `ip:${ip}`, RELAY_IP_LIMIT, WINDOW_MS)
    if (rl.limited) return rateLimited(cors, rl)
  }

  let url, userId
  const bodyText = await request.text()
  try {
    const parsed = JSON.parse(bodyText)
    url = parsed.url
    userId = parsed.userId
  } catch {
    const params = new URLSearchParams(bodyText)
    url = params.get('url')
    userId = params.get('userId')
  }

  // An authenticated caller's identity comes from the token, never the body.
  if (principal) userId = principal.uid

  console.log('Relay received:', { url: url?.slice(0, 80), userId: userId?.slice(0, 20), bodyLen: bodyText.length })

  if (!url || !userId) {
    return json({ error: 'Missing url or userId' }, 400, cors)
  }

  if (!/^[A-Za-z0-9_-]{6,128}$/.test(userId)) {
    return json({ error: 'Invalid userId' }, 400, cors)
  }

  if (!/^https?:\/\/(?:www\.)?instagram\.com\/(?:reel|p)\/[\w-]+/.test(url)) {
    return json({ error: 'Not a valid Instagram reel URL' }, 400, cors)
  }

  try {
    await writePendingUrl(env, userId, url)
    return json({ ok: true, message: 'URL saved. Open Reel Brain to see it processing.' }, 200, cors)
  } catch (e) {
    console.error('Relay error:', e)
    return json({ error: 'Internal server error' }, 500, cors)
  }
}

// ---- Auth helpers ----

async function authenticate(request, env) {
  const header = request.headers.get('Authorization')
  if (!header || !header.startsWith('Bearer ')) return null
  return verifyIdToken(header.slice(7), env.FIREBASE_PROJECT_ID)
}

function isAuthorized(request, env) {
  const expected = env.RELAY_SECRET
  if (!expected) return false
  const provided = request.headers.get('X-Relay-Secret')
  if (!provided) return false
  return secureCompare(provided, expected)
}

function secureCompare(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// ---- Response helpers ----

function json(body, status, cors, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors, ...extraHeaders },
  })
}

function methodNotAllowed(cors) {
  return json({ error: 'Method not allowed' }, 405, cors)
}

function unauthorized(cors) {
  return json({ error: 'Unauthorized' }, 401, cors)
}

function rateLimited(cors, rl) {
  return json({ error: 'Rate limited' }, 429, cors, {
    'Retry-After': String(Math.max(1, Math.ceil(rl.retryAfterMs / 1000))),
  })
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': 'https://mevikrampawar.github.io',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Relay-Secret',
  }
}
