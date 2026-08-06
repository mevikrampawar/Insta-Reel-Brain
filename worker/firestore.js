// Firestore REST helpers for Cloudflare Workers.
// Uses a Firebase service account (JWT → OAuth access token) which bypasses
// security rules — every caller must be authenticated by the worker itself.

export async function getAccessToken(env) {
  const email = env.FIREBASE_CLIENT_EMAIL
  const keyRaw = env.FIREBASE_PRIVATE_KEY

  if (!email || !keyRaw) {
    console.error('getAccessToken: missing FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY')
    return null
  }

  const keyData = decodePrivateKey(keyRaw)
  if (!keyData) {
    console.error('getAccessToken: could not decode private key')
    return null
  }

  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = base64url(JSON.stringify({
    iss: email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }))

  const signingInput = new TextEncoder().encode(`${header}.${payload}`)
  const key = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-256' } },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, signingInput)
  const sig = base64url(new Uint8Array(signature))

  const assertion = `${header}.${payload}.${sig}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${encodeURIComponent(assertion)}`,
  })

  const data = await res.json()
  if (!data.access_token) {
    console.error('getAccessToken failed:', res.status, data.error, data.error_description)
    return null
  }
  return data.access_token
}

export function documentsUrl(env, path) {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents/${path}`
}

async function firestoreRequest(env, url, init = {}) {
  const token = await getAccessToken(env)
  if (!token) throw new Error('Failed to get access token')
  return fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  })
}

// Writes a pending reel URL for the given user (iOS Shortcut relay).
export async function writePendingUrl(env, userId, url, source = 'ios-shortcut') {
  const timestamp = Date.now()
  const docId = `pending_${timestamp}_${Math.random().toString(36).slice(2, 8)}`
  const urlPath = `${documentsUrl(env, `users/${encodeURIComponent(userId)}/pendingUrls/${encodeURIComponent(docId)}`)}`

  const res = await firestoreRequest(urlPath, {
    method: 'PATCH',
    body: JSON.stringify({
      fields: {
        url: { stringValue: url },
        createdAt: { integerValue: String(timestamp) },
        source: { stringValue: source },
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('Firestore write failed:', err)
    throw new Error('Failed to save URL')
  }
  return { docId }
}

// ---- Server-side credits ledger (master-key free tier) ----
// Reserves one free-tier credit atomically. Reads/writes happen inside a
// readWrite transaction so concurrent requests cannot exceed the limit.
export async function reserveMasterCredit(env, uid, limit) {
  const settled = await runLedgerTxn(env, uid, count => {
    if (count >= limit) return { limitReached: true }
    return { next: count + 1 }
  })
  if (settled.limitReached) return { ok: false, limitReached: true, count: settled.count, limit }
  return { ok: true, count: settled.count, limit }
}

export async function releaseMasterCredit(env, uid) {
  const settled = await runLedgerTxn(env, uid, count => {
    if (count <= 0) return { noop: true }
    return { next: count - 1 }
  })
  return { ok: true, count: settled.count }
}

async function runLedgerTxn(env, uid, decide) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const txnId = await beginReadWriteTxn(env)
    const path = `users/${encodeURIComponent(uid)}/settings/preferences`
    const doc = await getDocInTxn(env, txnId, path)
    const count = parseInt(doc?.fields?.masterKeyUsage?.integerValue || '0', 10) || 0

    const decision = decide(count)
    if (decision.noop) {
      await rollbackTxn(env, txnId)
      return { count }
    }
    if (decision.limitReached) {
      await rollbackTxn(env, txnId)
      return { count, limitReached: true }
    }

    const write = buildUsageWrite(env, uid, doc, decision.next)
    try {
      await commitTxn(env, txnId, [write])
      return { count: decision.next }
    } catch (e) {
      if (e.aborted) continue
      throw e
    }
  }
  throw new Error('Credit ledger transaction retries exhausted')
}

function buildUsageWrite(env, uid, existingDoc, next) {
  const name = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${uid}/settings/preferences`
  const field = { integerValue: String(next) }
  if (existingDoc) {
    return {
      update: { name, fields: { masterKeyUsage: field } },
      updateMask: { fieldPaths: ['masterKeyUsage'] },
    }
  }
  return {
    update: {
      name,
      fields: {
        groqApiKey: { stringValue: '' },
        apifyApiKey: { stringValue: '' },
        masterKeyUsage: field,
        updatedAt: { integerValue: String(Date.now()) },
      },
    },
    currentDocument: { exists: false },
  }
}

async function beginReadWriteTxn(env) {
  const url = documentsUrl(env, '') + ':beginTransaction'
  const res = await firestoreRequest(url, { method: 'POST', body: JSON.stringify({ readWrite: {} }) })
  const data = await res.json()
  if (!res.ok) throw new Error(`beginTransaction failed: ${data?.error?.message || res.status}`)
  return data.transaction
}

async function getDocInTxn(env, txnId, path) {
  const res = await firestoreRequest(documentsUrl(env, path) + `?transaction=${encodeURIComponent(txnId)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`transaction read failed: ${res.status}`)
  return res.json()
}

async function commitTxn(env, txnId, writes) {
  const url = documentsUrl(env, '') + ':commit'
  const res = await firestoreRequest(url, { method: 'POST', body: JSON.stringify({ transaction: txnId, writes }) })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    if (data?.error?.status === 'ABORTED') {
      const e = new Error('transaction aborted')
      e.aborted = true
      throw e
    }
    throw new Error(`commit failed: ${data?.error?.message || res.status}`)
  }
  return res.json()
}

async function rollbackTxn(env, txnId) {
  try {
    const url = documentsUrl(env, '') + ':rollback'
    await firestoreRequest(url, { method: 'POST', body: JSON.stringify({ transaction: txnId }) })
  } catch {
    // rollback is best-effort
  }
}

// ---- Key decoding: handles both raw PEM and base64-encoded PEM ----

function decodePrivateKey(input) {
  const trimmed = input.trim()

  if (trimmed.startsWith('-----BEGIN')) {
    return pemToBytes(trimmed)
  }

  try {
    const decoded = atob(trimmed)
    if (decoded.startsWith('-----BEGIN')) {
      return pemToBytes(decoded)
    }
    return pemToBytes(decoded)
  } catch {
    return pemToBytes(trimmed)
  }
}

function pemToBytes(pem) {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s/g, '')
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

// ---- base64url encoding (RFC 4648, no padding, URL-safe) ----

function base64url(input) {
  let bytes
  if (typeof input === 'string') {
    bytes = new TextEncoder().encode(input)
  } else {
    bytes = input
  }
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
