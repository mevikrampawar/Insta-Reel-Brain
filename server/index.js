import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const APIFY_API = 'https://api.apify.com/v2';

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok' }));

// Proxy any Apify POST request
app.post('/api/apify', async (req, res) => {
  const { token, endpoint, payload } = req.body;

  if (!token || !endpoint) {
    return res.status(400).json({ error: 'Missing token or endpoint' });
  }

  try {
    const url = `${APIFY_API}/${endpoint}${endpoint.includes('?') ? '&' : '?'}token=${token}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('Apify proxy error:', err);
    res.status(500).json({ error: 'Proxy request failed' });
  }
});

// Poll run status (GET)
app.get('/api/apify/run', async (req, res) => {
  const { token, runUrl } = req.query;

  if (!token || !runUrl) {
    return res.status(400).json({ error: 'Missing token or runUrl' });
  }

  try {
    const url = `${runUrl}?token=${token}`;
    const response = await fetch(url);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('Apify poll error:', err);
    res.status(500).json({ error: 'Poll request failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
