const IG_APP_ID = '936619743392459'
const GRAPHQL_DOC_ID = '24368985919464652'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export default {
  async fetch(request, _env, _ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    try {
      const url = new URL(request.url)

      if (request.method === 'POST') {
        const body = await request.json()
        const shortcode = body.shortcode
        if (!shortcode) {
          return Response.json({ error: 'shortcode required' }, { status: 400, headers: CORS_HEADERS })
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
            doc_id: GRAPHQL_DOC_ID,
          }).toString(),
        })

        if (!igRes.ok) {
          return Response.json(
            { error: `Instagram API returned ${igRes.status}` },
            { status: igRes.status, headers: CORS_HEADERS },
          )
        }

        const data = await igRes.json()
        return Response.json(data, { headers: CORS_HEADERS })
      }

      if (request.method === 'GET' && url.searchParams.has('shortcode')) {
        const shortcode = url.searchParams.get('shortcode')
        const igRes = await fetch('https://www.instagram.com/graphql/query/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-IG-App-ID': IG_APP_ID,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          body: new URLSearchParams({
            variables: JSON.stringify({ shortcode }),
            doc_id: GRAPHQL_DOC_ID,
          }).toString(),
        })

        if (!igRes.ok) {
          return Response.json(
            { error: `Instagram API returned ${igRes.status}` },
            { status: igRes.status, headers: CORS_HEADERS },
          )
        }

        const data = await igRes.json()
        return Response.json(data, { headers: CORS_HEADERS })
      }

      return Response.json({ error: 'POST with {shortcode} or ?shortcode= param' }, { status: 400, headers: CORS_HEADERS })
    } catch (err) {
      return Response.json({ error: err.message || 'Internal error' }, { status: 500, headers: CORS_HEADERS })
    }
  },
}
