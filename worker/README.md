# Cloudflare Worker: Background Relay + Thin Server Layer

This worker serves two purposes for Reel Brain:

1. **Background relay** — lets the iOS Shortcut save reel URLs without opening Safari.
2. **Thin server layer** — verifies Firebase Auth ID tokens (JWKS), exposes typed `/api/*` routes, enforces server-side free-tier credits and per-user/per-IP rate limits.

## Why?

The relay writes to Firestore in the background (no browser open, no scrolling interrupted). The server layer is the migration path: credit limits move out of the browser (where they could be tampered with) onto the worker (which uses a service account that bypasses Firestore rules).

## Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/` or `/api/relay` | POST | `X-Relay-Secret` header **or** `Authorization: Bearer <Firebase ID token>` | Save a reel URL to `pendingUrls` |
| `/api/me` | GET | Bearer ID token | Return the authenticated user's info |
| `/api/usage/reserve` | POST | Bearer ID token | Atomically reserve one free-tier credit |
| `/api/usage/release` | POST | Bearer ID token | Atomically release one free-tier credit |
| `/api/ingest/enqueue` | POST | Bearer ID token | Start server-side ingestion (Apify→Groq→Firestore) for a reel URL |
| `/api/ingest/webhook` | POST | Apify webhook token (`?token=`) | Apify run-finished callback that advances the ingest job |
| `/api/ingest/cancel` | POST | Bearer ID token | Cancel an in-progress ingest job (aborts the Apify run, refunds the credit) |
| `/api/ingest/jobs` | GET | Bearer ID token | List in-progress ingest jobs for the user |

The credits ledger lives in `users/{uid}/settings/preferences` (field `masterKeyUsage`) and is mutated via **Firestore REST transactions**, so concurrent requests can't exceed `FREE_REEL_LIMIT` (default 5).

## Setup (one-time)

### 0. Provider keys (server-side ingestion)

Server-side ingestion (Phase 2b) runs on provider keys stored as worker secrets. Set them once:

```bash
npx wrangler secret put APIFY_API_TOKEN   # https://console.apify.com → Settings → API Token
npx wrangler secret put GROQ_API_KEY      # https://console.groq.com → API Keys
```

`WORKER_URL` (the public worker URL, used to build Apify webhook callbacks) is already set in `wrangler.jsonc`. For local development, put the same provider keys plus the Firebase secrets in a gitignored `.dev.vars` file:

```
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
RELAY_SECRET=...
APIFY_API_TOKEN=...
GROQ_API_KEY=...
```

### 1. Create a Firebase Service Account

1. Go to [Firebase Console](https://console.firebase.google.com) → your project → **Project Settings** (gear icon)
2. Click **Service Accounts** tab
3. Click **Generate New Private Key** → download the JSON file
4. Note these values: `client_email`, `private_key`, `project_id`

### 2. Configure + deploy (via Wrangler)

From this repo:

```bash
npm run deploy          # builds the app and runs `wrangler deploy`
```

Or just the worker: `npx wrangler deploy`.

### 3. Add Secrets

Wrangler deploys keep existing dashboard-configured secrets, but if you set them from the CLI:

```bash
npx wrangler secret put FIREBASE_PROJECT_ID
npx wrangler secret put FIREBASE_CLIENT_EMAIL
npx wrangler secret put FIREBASE_PRIVATE_KEY   # raw PEM (with newlines) or base64-encoded PEM
npx wrangler secret put RELAY_SECRET           # openssl rand -hex 32
```

Or set them in the dashboard: **Workers & Pages → reel-brain-relay → Settings → Variables**.

| Name | Value |
|------|-------|
| `FIREBASE_PROJECT_ID` | Your Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | From the service account JSON |
| `FIREBASE_PRIVATE_KEY` | The full private key (with `-----BEGIN...` and `-----END...`) |
| `RELAY_SECRET` | A random shared secret — generate with `openssl rand -hex 32` |

The KV namespace (`RATE_LIMIT_KV`) and the `FREE_REEL_LIMIT` var are declared in `wrangler.jsonc` — no dashboard action needed unless you deleted the namespace.

> `RELAY_SECRET` authenticates the relay. Every request must send it as the `X-Relay-Secret` header; requests without a matching value are rejected with **401**. The worker **fails closed** — if the secret isn't configured, all secret-authenticated requests are rejected. Requests with a valid Firebase ID token are also accepted (that's how the app talks to the worker).

### 4. Update the iOS Shortcut

1. Open **Shortcuts** app → tap **+** → create new shortcut
2. **Action 1:** Add Action → search "Receive input" → **Receive Input from Share Sheet**
3. **Action 2:** Add Action → search "Get contents of URL" → tap it
   - URL: `https://YOUR-WORKER-URL.workers.dev`
   - Method: **POST**
   - Headers:
     - `Content-Type` = `application/json`
     - `X-Relay-Secret` = **your `RELAY_SECRET`**
   - Request Body: **JSON**
     - Key: `url`, Value: `[Shortcut Input]`
     - Key: `userId`, Value: **copy from the app** — open Reel Brain → Settings → iOS Background Relay → tap copy next to your User ID
4. **Action 3:** Add Action → search "Show notification" → **Show Notification**
   - Text: `Reel saved! Open Reel Brain to see it processing.`
5. Rename shortcut to **"Save to Reel Brain"** → Done

### 5. How It Works

1. From Instagram → Share → "Save to Reel Brain"
2. The shortcut sends the URL (plus your User ID and the `X-Relay-Secret` header) to the Cloudflare Worker in the background
3. The worker verifies the secret, validates the URL and User ID, then writes to Firestore (`users/{uid}/pendingUrls/`)
4. You get a notification: "Reel saved!"
5. When you open Reel Brain, it picks up pending URLs and starts processing

**No browser opens. No scrolling interrupted.**

## Security

- The worker uses a Firebase **service account**, which bypasses Firestore security rules — that's why auth matters here. It enforces:
  - **Shared secret** (`RELAY_SECRET` via `X-Relay-Secret` header) **or** a verified **Firebase ID token** (RS256 signature checked against Google's JWKS, with `aud`/`iss`/`exp` validated).
  - **Strict `userId` format** (`[A-Za-z0-9_-]`, 6-128 chars) and **URL encoding** on every path segment, preventing path traversal into other users' data.
  - **Instagram-only URL validation** before anything is written.
  - **Rate limiting** per user (Bearer-auth'd routes) and per IP (relay without a token) via KV.
  - **Server-side credits**: `masterKeyUsage` is only ever mutated through the worker's Firestore transactions for token-authenticated requests.
- CORS is locked to the GitHub Pages origin; the real client (the Shortcut) is native and unaffected by CORS.

## Testing

Open the worker URL in a browser: `https://YOUR-WORKER-URL.workers.dev`
You should see: `{"error":"Method not allowed"}` (this means it's running).

From a terminal, verify auth works:

```bash
# No secret → 401
curl -X POST YOUR-WORKER-URL \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://www.instagram.com/reel/abc/","userId":"YOUR_UID"}'
# → {"error":"Unauthorized"}

# Wrong secret → 401
curl -X POST YOUR-WORKER-URL \
  -H 'Content-Type: application/json' \
  -H 'X-Relay-Secret: wrong' \
  -d '{"url":"https://www.instagram.com/reel/abc/","userId":"YOUR_UID"}'
# → {"error":"Unauthorized"}

# Usage endpoints require a Firebase ID token:
curl -X POST YOUR-WORKER-URL/api/usage/reserve \
  -H 'Authorization: Bearer <id-token>'
# → {"ok":true,"count":1,"limit":5,"limitReached":false}
```

## Cost

Cloudflare Workers free tier: 100,000 requests/day. More than enough for personal use.
