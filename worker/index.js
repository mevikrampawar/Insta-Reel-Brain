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
import {
  writePendingUrl,
  reserveMasterCredit,
  releaseMasterCredit,
  createIngestJob,
  getIngestJob,
  updateIngestJob,
  createPlaceholderReel,
  deleteReelDoc,
  findDocByField,
} from './firestore'
import { rateLimit } from './ratelimit'
import { IngestQueue } from './ingest-queue'
import { normalizeUrl, buildPlaceholderReelFields } from './ingest'

export { IngestQueue }

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
    if (url.pathname === '/api/ingest/enqueue') {
      return handleIngestEnqueue(request, env, cors)
    }
    if (url.pathname === '/api/ingest/webhook') {
      return handleIngestWebhook(request, env, cors)
    }
    if (url.pathname === '/api/ingest/cancel') {
      return handleIngestCancel(request, env, cors)
    }
    if (url.pathname === '/api/ingest/jobs') {
      return handleIngestJobs(request, env, cors)
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

async function handleIngestEnqueue(request, env, cors) {
  if (request.method !== 'POST') return methodNotAllowed(cors)
  const principal = await authenticate(request, env)
  if (!principal) return unauthorized(cors)

  const rl = await rateLimit(env, `uid:${principal.uid}`, API_USER_LIMIT, WINDOW_MS)
  if (rl.limited) return rateLimited(cors, rl)

  const body = await request.json().catch(() => ({}))
  const url = body.url
  const source = typeof body.source === 'string' && ['manual', 'upload', 'telegram', 'ios-shortcut'].includes(body.source)
    ? body.source
    : 'manual'
  if (!url || typeof url !== 'string') return json({ error: 'Missing url' }, 400, cors)

  if (!/^https?:\/\/(?:www\.)?instagram\.com\/(?:reel|p)\/[\w-]+/.test(url.trim())) {
    return json({ error: 'Not a valid Instagram reel URL' }, 400, cors)
  }

  const normalized = normalizeUrl(url)
  const raw = url.trim()

  try {
    const existingReel = await findDocByField(env, principal.uid, 'reels', 'url', [normalized, raw])
    if (existingReel) {
      return json({ ok: false, error: 'duplicate', message: 'This reel is already in your library' }, 409, cors)
    }
    const existingJob = await findDocByField(env, principal.uid, 'ingestJobs', 'urlKey', [normalized])
    if (existingJob && ['queued', 'running', 'analyzing', 'retry'].includes(existingJob.status)) {
      return json({ ok: false, error: 'duplicate', message: 'This reel is already processing' }, 409, cors)
    }
  } catch (e) {
    console.error('Enqueue dedup query failed:', e)
  }

  const limit = Number(env.FREE_REEL_LIMIT || DEFAULT_FREE_REEL_LIMIT) || DEFAULT_FREE_REEL_LIMIT
  let reserved
  try {
    reserved = await reserveMasterCredit(env, principal.uid, limit)
  } catch (e) {
    console.error('Enqueue reserve failed:', e)
    return json({ error: 'Failed to reserve credit' }, 500, cors)
  }
  if (!reserved.ok) {
    return json({
      ok: false,
      error: 'limit-reached',
      message: 'Free trial limit reached — add your own API keys in Settings to keep saving reels',
      count: reserved.count,
      limit: reserved.limit,
    }, 403, cors)
  }

  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const webhookToken = randomToken()
  const now = Date.now()
  let reelId = null
  try {
    const placeholder = buildPlaceholderReelFields(principal.uid, url, source)
    reelId = await createPlaceholderReel(env, principal.uid, placeholder)
    await createIngestJob(env, principal.uid, {
      jobId,
      reelId,
      uid: principal.uid,
      url,
      urlKey: normalized,
      source,
      status: 'queued',
      webhookToken,
      creditReserved: true,
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    })

    const id = await ingestQueueId(env, principal.uid)
    const stub = env.INGEST_QUEUE.get(id)
    await stub.enqueue({ jobId, reelId, uid: principal.uid, url, source, webhookToken, creditReserved: true })
    return json({ ok: true, jobId, reelId, status: 'queued' }, 201, cors)
  } catch (e) {
    console.error('Enqueue failed:', e)
    if (reelId) {
      await updateIngestJob(env, principal.uid, jobId, { status: 'failed', error: 'enqueue failed' }).catch(() => {})
      await deleteReelDoc(env, principal.uid, reelId).catch(() => {})
    }
    await releaseMasterCredit(env, principal.uid).catch(() => {})
    return json({ error: 'Failed to enqueue' }, 500, cors)
  }
}

async function handleIngestWebhook(request, env, cors) {
  if (request.method !== 'POST') return methodNotAllowed(cors)
  const url = new URL(request.url)
  const jobId = url.searchParams.get('jobId')
  const token = url.searchParams.get('token') || ''
  const uid = url.searchParams.get('uid') || ''
  if (!jobId || !uid) return json({ error: 'Missing jobId or uid' }, 400, cors)
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(uid)) return json({ error: 'Invalid uid' }, 400, cors)

  const body = await request.json().catch(() => ({}))
  const eventType = body.eventType
  if (!eventType) return json({ error: 'Missing eventType' }, 400, cors)

  try {
    const job = await getIngestJob(env, uid, jobId)
    if (!job) return json({ ok: false, error: 'unknown job' }, 404, cors)
    if (!job.webhookToken || !secureCompare(token, job.webhookToken)) {
      return json({ ok: false, error: 'Unauthorized' }, 401, cors)
    }
  } catch (e) {
    console.error('Webhook job lookup failed:', e)
    return json({ error: 'Internal server error' }, 500, cors)
  }

  const id = await ingestQueueId(env, uid)
  const stub = env.INGEST_QUEUE.get(id)
  try {
    await stub.webhook({ jobId, token, eventType })
  } catch (e) {
    console.error('Webhook forward failed:', e)
    return json({ error: 'Internal server error' }, 500, cors)
  }
  return json({ ok: true }, 200, cors)
}

async function handleIngestCancel(request, env, cors) {
  if (request.method !== 'POST') return methodNotAllowed(cors)
  const principal = await authenticate(request, env)
  if (!principal) return unauthorized(cors)

  const rl = await rateLimit(env, `uid:${principal.uid}`, API_USER_LIMIT, WINDOW_MS)
  if (rl.limited) return rateLimited(cors, rl)

  const body = await request.json().catch(() => ({}))
  const jobId = body.jobId
  if (!jobId) return json({ error: 'Missing jobId' }, 400, cors)

  const id = await ingestQueueId(env, principal.uid)
  const stub = env.INGEST_QUEUE.get(id)
  const result = await stub.cancel({ jobId })
  if (!result.ok) return json({ ok: false, error: result.error }, 404, cors)
  return json({ ok: true }, 200, cors)
}

async function handleIngestJobs(request, env, cors) {
  if (request.method !== 'GET') return methodNotAllowed(cors)
  const principal = await authenticate(request, env)
  if (!principal) return unauthorized(cors)

  const rl = await rateLimit(env, `uid:${principal.uid}`, API_USER_LIMIT, WINDOW_MS)
  if (rl.limited) return rateLimited(cors, rl)

  const id = await ingestQueueId(env, principal.uid)
  const stub = env.INGEST_QUEUE.get(id)
  const result = await stub.list()
  return json({ ok: true, ...result }, 200, cors)
}

async function ingestQueueId(env, uid) {
  const data = new TextEncoder().encode(uid)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const hex = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
  return env.INGEST_QUEUE.idFromName(`user_${hex.slice(0, 16)}`)
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
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
