// Firebase ID-token verification for Cloudflare Workers.
// Verifies RS256 JWTs issued by Firebase Auth (the `securetoken` service)
// against Google's public JWKS. Caches keys for an hour and reuses an
// in-flight fetch to avoid stampedes on key rotation.

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
const KEY_CACHE_TTL_MS = 60 * 60 * 1000

let jwksCache = { keys: null, fetchedAt: 0 }
let jwksFetching = null

async function getJwks() {
  if (jwksCache.keys && Date.now() - jwksCache.fetchedAt < KEY_CACHE_TTL_MS) return jwksCache.keys
  if (!jwksFetching) {
    jwksFetching = (async () => {
      const res = await fetch(JWKS_URL)
      if (!res.ok) {
        if (jwksCache.keys) return jwksCache.keys
        throw new Error(`JWKS fetch failed: ${res.status}`)
      }
      const data = await res.json()
      jwksCache = { keys: data.keys, fetchedAt: Date.now() }
      return data.keys
    })().finally(() => { jwksFetching = null })
  }
  return jwksFetching
}

// Verifies a Firebase Auth ID token. Returns a principal object
// { uid, email, name } or null if the token is invalid/expired.
export async function verifyIdToken(token, projectId) {
  if (!token || typeof token !== 'string') return null
  if (!projectId) return null

  const parts = token.split('.')
  if (parts.length !== 3) return null

  let header, payload
  try {
    header = JSON.parse(new TextDecoder().decode(base64urlToBytes(parts[0])))
    payload = JSON.parse(new TextDecoder().decode(base64urlToBytes(parts[1])))
  } catch {
    return null
  }

  if (header.alg !== 'RS256' || !header.kid) return null
  if (payload.aud !== projectId) return null
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null
  if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) return null
  if (typeof payload.sub !== 'string' || !payload.sub) return null

  const keys = await getJwks()
  const jwk = (keys || []).find(k => k.kid === header.kid && k.kty === 'RSA')
  if (!jwk) return null

  const signingData = new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  const signature = base64urlToBytes(parts[2])

  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', use: 'sig' },
    { name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-256' } },
    false,
    ['verify'],
  )

  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signingData)
  if (!valid) return null

  return { uid: payload.sub, email: payload.email || null, name: payload.name || null }
}

function base64urlToBytes(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
  const bin = atob(b64 + pad)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}
