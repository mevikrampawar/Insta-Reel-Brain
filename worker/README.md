# Instagram Proxy Worker (Cloudflare)

Proxies requests to Instagram's GraphQL API and Apify API to bypass CORS restrictions.

## Deploy / Redeploy (2 minutes, 100% free)

1. Go to https://dash.cloudflare.com → Sign up (free)
2. Click **Workers & Pages** → select your existing worker (or create new)
3. Click **Edit Code** → **DELETE all existing code** → paste the contents of `instagram-proxy.js`
4. Click **Deploy**
5. Copy your worker URL: `https://ig-proxy.YOUR_SUBDOMAIN.workers.dev`

Then in Insta Reel Brain → **Settings** → paste the URL.

## What it does

- `POST /` with `{shortcode}` → proxies Instagram GraphQL API
- `POST /?action=apify` with `{apifyToken, endpoint, method, payload}` → proxies Apify API
- Handles CORS preflight (OPTIONS) for browser requests

## Free Tier Limits

- 100,000 requests/day (way more than needed)
- No credit card required
- Runs on Cloudflare's edge network (fast worldwide)

## Troubleshooting

- **400 error on `?action=apify`**: Worker is running old code. Redeploy with the latest `instagram-proxy.js`.
- **403 from Instagram**: Instagram blocks anonymous GraphQL. Use Apify instead.
- **Worker shows "Connected" but extraction fails**: Redeploy the worker code.
