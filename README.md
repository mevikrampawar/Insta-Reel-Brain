# Insta Reel Brain

AI-powered personal knowledge system for Instagram Reels. Search, organize, and rediscover everything you save.

## Stack

- **Frontend:** React, TypeScript, Tailwind CSS, Vite
- **Backend:** Firebase Auth + Firestore
- **AI:** Groq API (LLM) + Apify (scraping)
- **Deploy:** GitHub Pages + Firebase Cloud Functions

## Setup

1. **Frontend** — `npm install && npm run dev`
2. **Cloud Function** — `cd functions && npm install`
3. **Deploy Cloud Function** — `npx firebase deploy --only functions`
4. **Deploy Frontend** — push to `main` (auto-deploys via GitHub Actions)

API keys are stored per-user in Firestore via the Settings page. No `.env` files needed.

## Architecture

```
Browser (GitHub Pages)
  ├── Groq API (direct — supports CORS)
  └── Firebase Cloud Function (proxy)
        └── Apify API (scraping)
```

The Cloud Function exists solely because Apify's API blocks browser CORS requests. It's a stateless proxy — no keys stored server-side.
