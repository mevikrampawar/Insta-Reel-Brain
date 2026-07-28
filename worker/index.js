// Cloudflare Worker: background relay for iOS Shortcut
// Receives reel URLs and writes them to Firestore without opening a browser
//
// SETUP:
// 1. Create a Firebase service account (Project Settings > Service Accounts > Generate New Private Key)
// 2. In Cloudflare dashboard: Workers & Pages > Create Application > Paste this script
// 3. Add secrets: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
// 4. Deploy and note your worker URL (e.g., https://reel-brain-relay.YOUR_SUBDOMAIN.workers.dev)
// 5. Update the iOS Shortcut to use "Get Contents of URL" with: POST https://reel-brain-relay.YOUR_SUBDOMAIN.workers.dev
//    Headers: Content-Type: application/json
//    Body: {"url": "[Shortcut Input]", "userId": "YOUR_FIREBASE_UID"}

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders(),
      })
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

      // Try JSON parse first
      try {
        const parsed = JSON.parse(bodyText)
        url = parsed.url
        userId = parsed.userId
      } catch {
        // Fallback: try form-encoded (key=value&key=value)
        const params = new URLSearchParams(bodyText)
        url = params.get('url')
        userId = params.get('userId')
      }

      console.log('Relay received:', { url: url?.slice(0, 80), userId: userId?.slice(0, 20), bodyLen: bodyText.length })

      if (!url || !userId) {
        return new Response(JSON.stringify({ error: 'Missing url or userId', receivedKeys: Object.keys(JSON.parse(bodyText || '{}')) }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders() },
        })
      }

      // Validate it's an Instagram URL
      if (!/^https?:\/\/(?:www\.)?instagram\.com\/(?:reel|p)\/[\w-]+/.test(url)) {
        return new Response(JSON.stringify({ error: 'Not a valid Instagram reel URL' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders() },
        })
      }

      // Write to Firestore: users/{userId}/pendingUrls/{timestamp}
      const timestamp = Date.now()
      const docId = `pending_${timestamp}_${Math.random().toString(36).slice(2, 8)}`
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${userId}/pendingUrls/${docId}`

      const token = await getAccessToken(env)
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

async function getAccessToken(env) {
  console.log('getAccessToken: starting, email:', env.FIREBASE_CLIENT_EMAIL, 'keyLen:', env.FIREBASE_PRIVATE_KEY?.length)
  const now = Math.floor(Date.now() / 1000)
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({
    iss: env.FIREBASE_CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }))

  const encoder = new TextEncoder()
  const keyBuffer = pemToArrayBuffer(env.FIREBASE_PRIVATE_KEY)
  console.log('getAccessToken: parsed key buffer length:', keyBuffer.byteLength)
  const key = await crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const dataToSign = encoder.encode(`${header}.${payload}`)
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, dataToSign)
  const sigBytes = new Uint8Array(signature)
  let sigB64 = ''
  for (let i = 0; i < sigBytes.length; i++) sigB64 += String.fromCharCode(sigBytes[i])

  const assertion = `${header}.${payload}.${btoa(sigB64)}`
  console.log('getAccessToken: assertion length:', assertion.length, 'sig bytes:', sigBytes.length)

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${assertion}`,
  })
  const tokenData = await res.json()
  console.log('getAccessToken: token response status:', res.status, 'has_token:', !!tokenData.access_token, 'error:', tokenData.error, 'error_description:', tokenData.error_description)
  return tokenData.access_token
}

function pemToArrayBuffer(pem) {
  // Handle literal \n strings (common when pasting into Cloudflare secrets)
  const normalized = pem.replace(/\\n/g, '\n')
  const b64 = normalized.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s/g, '')
  console.log('PEM key first20:', b64.slice(0, 20), 'last20:', b64.slice(-20), 'b64len:', b64.length)
  const binary = atob(b64)
  const buffer = new ArrayBuffer(binary.length)
  const view = new Uint8Array(buffer)
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i)
  return buffer
}
