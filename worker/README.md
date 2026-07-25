# Apify Proxy Worker (Cloudflare)

Proxies requests from the browser to Apify's API. Browsers can't call `api.apify.com` directly (CORS blocks POST). This worker runs on Cloudflare's servers and bypasses that restriction.

## Deploy (2 minutes, 100% free)

1. Go to https://dash.cloudflare.com → Sign up (free)
2. Click **Workers & Pages** → **Create Application** → **Create Worker**
3. Name it (e.g. `ig-proxy`) → **Deploy**
4. Click the worker → **Edit Code** → **DELETE all code** → paste contents of `instagram-proxy.js`
5. Click **Deploy**
6. Copy your worker URL: `https://ig-proxy.YOUR_SUBDOMAIN.workers.dev`

Then in Insta Reel Brain → **Settings** → paste the URL.

## What it does

- `POST /` with `{token, endpoint, payload}` → proxies to `https://api.apify.com/v2/{endpoint}`
- Handles CORS preflight (OPTIONS)
- That's it — simple and clean

## Free Tier Limits

- 100,000 requests/day (way more than needed)
- No credit card required
- Runs on Cloudflare's edge network (fast worldwide)

## Troubleshooting

- **Test Connection says "Unreachable"**: Redeploy the worker code
- **Extraction fails**: Make sure both Apify key AND Worker URL are saved in Settings
