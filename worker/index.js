// Cloudflare Worker: background relay for iOS Shortcut
// Receives reel URLs and writes them to Firestore without opening a browser
//
// SETUP:
// 1. Create a Firebase service account (Project Settings > Service Accounts > Generate New Private Key)
// 2. In Cloudflare dashboard: Workers & Pages > reel-brain-relay > Edit Code
// 3. Paste this script and deploy
// 4. Add secrets via Settings > Variables: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
//    FIREBASE_PRIVATE_KEY can be stored as raw PEM (with newlines) OR base64-encoded PEM
// 5. Update the iOS Shortcut to POST to: https://reel-brain-relay.YOUR_SUBDOMAIN.workers.dev

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() })
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      })
    }

    try {
      const bodyText = await request.text()
      let url, userId

      try {
        const parsed = JSON.parse(bodyText)
        url = parsed.url
        userId = parsed.userId
      } catch {
        const params = new URLSearchParams(bodyText)
        url = params.get('url')
        userId = params.get('userId')
      }

      console.log('Relay received:', { url: url?.slice(0, 80), userId: userId?.slice(0, 20), bodyLen: bodyText.length })

      if (!url || !userId) {
        return new Response(JSON.stringify({ error: 'Missing url or userId' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders() },
        })
      }

      if (!/^https?:\/\/(?:www\.)?instagram\.com\/(?:reel|p)\/[\w-]+/.test(url)) {
        return new Response(JSON.stringify({ error: 'Not a valid Instagram reel URL' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders() },
        })
      }

      const timestamp = Date.now()
      const docId = `pending_${timestamp}_${Math.random().toString(36).slice(2, 8)}`
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${userId}/pendingUrls/${docId}`

      const token = await getAccessToken(env)
      if (!token) {
        return new Response(JSON.stringify({ error: 'Failed to get access token' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders() },
        })
      }

      const res = await fetch(firestoreUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            url: { stringValue: url },
            createdAt: { integerValue: String(timestamp) },
            source: { stringValue: 'ios-shortcut' },
          },
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        console.error('Firestore write failed:', err)
        return new Response(JSON.stringify({ error: 'Failed to save URL' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders() },
        })
      }

      return new Response(JSON.stringify({ ok: true, message: 'URL saved. Open Reel Brain to see it processing.' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      })
    } catch (e) {
      console.error('Relay error:', e.message)
      return new Response(JSON.stringify({ error: 'Invalid request', detail: e.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      })
    }
  },
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

// ---- JWT / Service Account Auth ----

async function getAccessToken(env) {
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
