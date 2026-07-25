export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { apifyApiKey, endpoint, method = 'POST', payload } = req.body;

  if (!apifyApiKey || !endpoint) {
    return res.status(400).json({ error: 'Missing apifyApiKey or endpoint' });
  }

  try {
    const fetchOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apifyApiKey.trim()}`,
      },
    };
    if (method !== 'GET' && payload) {
      fetchOptions.body = JSON.stringify(payload);
    }

    const apiRes = await fetch(`https://api.apify.com/v2/${endpoint}`, fetchOptions);
    const contentType = apiRes.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const data = await apiRes.json();
      return res.status(apiRes.status).json(data);
    } else {
      const text = await apiRes.text();
      return res.status(apiRes.status).send(text);
    }
  } catch (err) {
    console.error('Apify proxy error:', err);
    return res.status(502).json({ error: 'Proxy request failed' });
  }
}
