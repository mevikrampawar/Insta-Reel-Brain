const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS })
    }

    try {
      const { token, endpoint, payload } = await request.json()

      if (!token || !endpoint) {
        return new Response(JSON.stringify({ error: 'token and endpoint required' }), {
          status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
        })
      }

      const res = await fetch(`https://api.apify.com/v2/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
  },
}
