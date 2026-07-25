# Insta Reel Brain - Backend Server

Tiny Node.js proxy that forwards requests to the Apify API. Deploy to Render, Railway, or Fly.io (all have free tiers).

## Deploy to Render

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repo
4. Settings:
   - **Root Directory:** `server`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Click "Create Web Service"
6. Copy the URL (e.g., `https://your-app.onrender.com`)
7. Paste it in Settings → Backend URL

## Deploy to Railway

1. Go to [railway.app](https://railway.app) → New Project
2. Connect your GitHub repo
3. Settings → Source → set **Root Directory** to `server`
4. Railway auto-detects Node.js and deploys
5. Copy the URL from Settings → Domains
6. Paste it in Settings → Backend URL

## Deploy to Fly.io

1. Install flyctl: `curl -L https://fly.io/install.sh | sh`
2. In the `server/` directory: `fly launch`
3. `fly deploy`
4. `fly apps list` to get your URL
5. Paste it in Settings → Backend URL

## Local Development

```bash
cd server
npm install
npm run dev
# Server runs on http://localhost:3001
```

## API

### POST /api/apify
Forwards requests to Apify API.

```json
{
  "token": "apify_api_...",
  "endpoint": "acts/apify/instagram-reel-scraper/runs?token=...",
  "payload": { "directUrls": ["..."], "addTranscription": true }
}
```

### GET /api/apify/run?token=...&runUrl=...
Polls an Apify run status.

### GET /health
Health check endpoint.
