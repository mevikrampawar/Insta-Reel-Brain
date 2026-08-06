# Cloudflare Worker: Background Relay for iOS Shortcut

This worker lets the iOS Shortcut send reel URLs in the background **without opening Safari**.

## Why?

When you share from Instagram to a Shortcut that opens a URL, iOS switches to Safari — interrupting your scrolling. This worker receives the URL silently in the background.

## Setup (one-time, ~5 minutes)

### 1. Create a Firebase Service Account

1. Go to [Firebase Console](https://console.firebase.google.com) → your project → **Project Settings** (gear icon)
2. Click **Service Accounts** tab
3. Click **Generate New Private Key** → download the JSON file
4. Open the JSON file and note these values:
   - `client_email`
   - `private_key`
   - `project_id`

### 2. Create the Cloudflare Worker

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages**
2. Click **Create Application** → **Create Worker**
3. Name it (e.g., `reel-brain-relay`)
4. **Paste the contents of `worker/index.js`** into the code editor
5. Click **Deploy**

### 3. Add Secrets

In the worker's settings tab, add these environment variables (as **Secrets**):

| Name | Value |
|------|-------|
| `FIREBASE_PROJECT_ID` | Your Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | From the service account JSON |
| `FIREBASE_PRIVATE_KEY` | The full private key (with `-----BEGIN...` and `-----END...`) |
| `RELAY_SECRET` | A random shared secret — generate with `openssl rand -hex 32` |

> `RELAY_SECRET` is the relay's only authentication. Every request must send it as the `X-Relay-Secret` header; requests without a matching value are rejected with **401 Unauthorized**. The worker **fails closed** — if the secret isn't configured, all requests are rejected.

### 4. Deploy

Click **Deploy** again. Note your worker URL (e.g., `https://reel-brain-relay.YOUR_SUBDOMAIN.workers.dev`).

### 5. Update the iOS Shortcut

Replace the old shortcut with this flow:

1. Open **Shortcuts** app → tap **+** → create new shortcut
2. **Action 1:** Add Action → search "Receive input" → **Receive Input from Share Sheet**
3. **Action 2:** Add Action → search "Get contents of URL" → tap it
   - URL: `https://YOUR-WORKER-URL.workers.dev`
   - Method: **POST**
   - Headers:
     - `Content-Type` = `application/json`
     - `X-Relay-Secret` = **your `RELAY_SECRET`** (same value you set in Cloudflare)
   - Request Body: **JSON**
     - Key: `url`, Value: `[Shortcut Input]`
     - Key: `userId`, Value: **copy from the app** — open Reel Brain → Settings → iOS Background Relay → tap copy next to your User ID
4. **Action 3:** Add Action → search "Show notification" → **Show Notification**
   - Text: `Reel saved! Open Reel Brain to see it processing.`
5. Rename shortcut to **"Save to Reel Brain"** → Done

### 6. How It Works

1. From Instagram → Share → "Save to Reel Brain"
2. The shortcut sends the URL (plus your User ID and the `X-Relay-Secret` header) to the Cloudflare Worker in the background
3. The worker verifies the secret, validates the URL and User ID, then writes to Firestore (`users/{uid}/pendingUrls/`)
4. You get a notification: "Reel saved!"
5. When you open Reel Brain, it picks up pending URLs and starts processing

**No browser opens. No scrolling interrupted.**

## Security

- The worker uses a Firebase **service account**, which bypasses Firestore security rules — that's why auth matters here. It enforces:
  - **Shared secret** (`RELAY_SECRET` via `X-Relay-Secret` header) — rejects anything else with 401.
  - **Strict `userId` format** (`[A-Za-z0-9_-]`, 6-128 chars) and **URL encoding** on every path segment, preventing path traversal into other users' data.
  - **Instagram-only URL validation** before anything is written.
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
```

## Cost

Cloudflare Workers free tier: 100,000 requests/day. More than enough for personal use.
