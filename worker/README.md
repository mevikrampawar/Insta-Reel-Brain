# Instagram Proxy Worker (Cloudflare)

Proxies requests to Instagram's GraphQL API to bypass CORS restrictions.
Returns full reel metadata: title, creator, caption, hashtags, video URL, thumbnail, likes, comments.

## Deploy (2 minutes, 100% free)

1. Go to https://dash.cloudflare.com → Sign up (free)
2. Click **Workers & Pages** → **Create Application** → **Create Worker**
3. Name it (e.g. `ig-proxy`) → **Deploy**
4. Click the worker → **Edit Code** → Paste the contents of `instagram-proxy.js`
5. Click **Deploy**
6. Copy your worker URL: `https://ig-proxy.YOUR_SUBDOMAIN.workers.dev`

Then in Insta Reel Brain → **Settings** → paste the URL.

## Free Tier Limits

- 100,000 requests/day (way more than needed)
- No credit card required
- Runs on Cloudflare's edge network (fast worldwide)
