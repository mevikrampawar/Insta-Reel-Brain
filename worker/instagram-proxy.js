const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
}

function corsResponse(body, status = 200) {
  return new Response(body, { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

const IG_APP_ID = '936619743392459'

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS })
    }

    try {
      const url = new URL(request.url)
      const action = url.searchParams.get('action')

      // Proxy Apify API calls
      if (action === 'apify') {
        const body = await request.json()
        const { apifyToken, endpoint, method, payload } = body

        if (!apifyToken || !endpoint) {
          return corsResponse({ error: 'apifyToken and endpoint required' }, 400)
        }

        const apifyRes = await fetch(`https://api.apify.com/v2/${endpoint}`, {
          method: method || 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apifyToken}`,
          },
          body: payload ? JSON.stringify(payload) : undefined,
        })

        const data = await apifyRes.json()
        return corsResponse(data, apifyRes.status)
      }

      // Proxy Instagram GraphQL
      if (request.method === 'POST') {
        const body = await request.json()
        const shortcode = body.shortcode
        if (!shortcode) {
          return corsResponse({ error: 'shortcode required' }, 400)
        }

        const igRes = await fetch('https://www.instagram.com/graphql/query/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-IG-App-ID': IG_APP_ID,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          body: new URLSearchParams({
            variables: JSON.stringify({ shortcode }),
            doc_id: '24368985919464652',
          }).toString(),
        })

        if (!igRes.ok) {
          return corsResponse({ error: `Instagram API ${igRes.status}` }, igRes.status)
        }

        const data = await igRes.json()
        return corsResponse(data)
      }

      return corsResponse({ error: 'POST {shortcode} or POST {action:"apify", ...}' }, 400)
    } catch (err) {
      return corsResponse({ error: err.message || 'Internal error' }, 500)
    }
  },
}
