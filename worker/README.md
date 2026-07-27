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

### 4. Deploy

Click **Deploy** again. Note your worker URL (e.g., `https://reel-brain-relay.YOUR_SUBDOMAIN.workers.dev`).

### 5. Update the iOS Shortcut

Replace the old shortcut with this flow:

1. Open **Shortcuts** app → tap **+** → create new shortcut
2. **Action 1:** Add Action → search "Receive input" → **Receive Input from Share Sheet**
3. **Action 2:** Add Action → search "Get contents of URL" → tap it
   - URL: `https://YOUR-WORKER-URL.workers.dev`
   - Method: **POST**
   - Headers: `Content-Type` = `application/json`
   - Request Body: **JSON**
     - Key: `url`, Value: `[Shortcut Input]`
     - Key: `userId`, Value: `YOUR_FIREBASE_UID` (find in Firebase Console → Authentication → Users)
4. **Action 3:** Add Action → search "Show notification" → **Show Notification**
   - Text: `Reel saved! Open Reel Brain to process it.`
5. Rename shortcut to **"Save to Reel Brain"** → Done

### 6. How It Works

1. From Instagram → Share → "Save to Reel Brain"
2. The shortcut sends the URL to the Cloudflare Worker in the background
3. The worker writes it to Firestore (`users/{uid}/pendingUrls/`)
4. You get a notification: "Reel saved!"
5. When you open Reel Brain, it picks up pending URLs and starts processing

**No browser opens. No scrolling interrupted.**

## Testing

Open the worker URL in a browser: `https://YOUR-WORKER-URL.workers.dev`
You should see: `{"error":"Method not allowed"}` (this means it's running).

## Cost

Cloudflare Workers free tier: 100,000 requests/day. More than enough for personal use.
